import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import ALYOSSStream from 'aliyun-oss-upload-stream';
import ALY from 'aliyun-sdk';
import AWS from 'aws-sdk';
import COS from 'cos-nodejs-sdk-v5';
import fsextra from 'fs-extra';
import { Logger } from 'kv-logger';
import _ from 'lodash';
import qiniu from 'qiniu';
import { AppError } from '../app-error';
import { config } from '../config';

function uploadFileToLocal(key: string, filePath: string, logger: Logger): Promise<void> {
    return new Promise((resolve, reject) => {
        logger.info('=== uploadFileToLocal 시작 ===', {
            key,
            filePath,
            timestamp: new Date().toISOString(),
        });

        const storageDir = _.get(config, 'local.storageDir');
        logger.info('로컬 스토리지 설정 확인', {
            storageDir,
            hasStorageDir: !!storageDir,
        });

        if (!storageDir) {
            const errorMsg = 'please set config local storageDir';
            logger.error('로컬 스토리지 설정 오류', { errorMsg });
            throw new AppError(errorMsg);
        }
        if (key.length < 3) {
            const errorMsg = `generate key is too short, key value:${key}`;
            logger.error('키 길이 오류', { key, keyLength: key.length, errorMsg });
            throw new AppError('generate key is too short.');
        }
        try {
            logger.debug(`uploadFileToLocal check directory ${storageDir} fs.W_OK`);
            fs.accessSync(storageDir, fs.constants.W_OK);
            logger.debug(`uploadFileToLocal directory ${storageDir} fs.W_OK is ok`);
        } catch (err) {
            logger.error('스토리지 디렉토리 접근 권한 확인 실패', {
                storageDir,
                error: err.message,
                errorCode: err.code,
            });
            throw new AppError(err);
        }
        const subDir = key.substring(0, 2).toLowerCase();
        const finalDir = path.join(storageDir, subDir);
        const fileName = path.join(finalDir, key);

        logger.info('로컬 파일 경로 정보', {
            subDir,
            finalDir,
            fileName,
            finalDirExists: fs.existsSync(finalDir),
            fileExists: fs.existsSync(fileName),
        });

        if (fs.existsSync(fileName)) {
            logger.info(`uploadFileToLocal file exists, skip copy`, {
                key,
                fileName,
            });

            resolve();
            return;
        }
        let stats = fs.statSync(storageDir);
        if (!stats.isDirectory()) {
            const errorMsg = `${storageDir} must be directory`;
            logger.error('스토리지 경로가 디렉토리가 아님', { storageDir, errorMsg });
            throw new AppError(errorMsg);
        }
        if (!fs.existsSync(`${finalDir}`)) {
            fs.mkdirSync(`${finalDir}`);
            logger.info(`uploadFileToLocal mkdir:${finalDir}`, {
                key,
                finalDir,
            });
        }
        try {
            fs.accessSync(filePath, fs.constants.R_OK);
            logger.info('소스 파일 접근 권한 확인 성공', { filePath });
        } catch (err) {
            logger.error('소스 파일 접근 권한 확인 실패', {
                filePath,
                error: err.message,
                errorCode: err.code,
            });
            throw new AppError(err);
        }
        stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            const errorMsg = `${filePath} must be file`;
            logger.error('소스 경로가 파일이 아님', { filePath, errorMsg });
            throw new AppError(errorMsg);
        }

        logger.info('파일 복사 시작', {
            source: filePath,
            destination: fileName,
            fileSize: stats.size,
        });

        fsextra.copy(filePath, fileName, (err) => {
            if (err) {
                logger.error('=== uploadFileToLocal 실패 ===', {
                    key,
                    source: filePath,
                    destination: fileName,
                    error: err.message,
                    errorStack: err.stack,
                    timestamp: new Date().toISOString(),
                });
                reject(new AppError(err));
                return;
            }
            logger.info('=== uploadFileToLocal 성공 ===', {
                key,
                source: filePath,
                destination: fileName,
                timestamp: new Date().toISOString(),
            });
            resolve();
        });
    });
}

function uploadFileToS3(key: string, filePath: string, logger: Logger): Promise<void> {
    return new Promise((resolve, reject) => {
        logger.info('=== uploadFileToS3 시작 ===', { 
            key,
            filePath,
            timestamp: new Date().toISOString(),
        });

        const s3Config = {
            accessKeyId: _.get(config, 's3.accessKeyId'),
            secretAccessKey: _.get(config, 's3.secretAccessKey'),
            sessionToken: _.get(config, 's3.sessionToken'),
            region: _.get(config, 's3.region'),
        };

        logger.info('S3 설정 정보', {
            hasAccessKeyId: !!s3Config.accessKeyId,
            hasSecretAccessKey: !!s3Config.secretAccessKey,
            hasSessionToken: !!s3Config.sessionToken,
            region: s3Config.region,
            bucketName: _.get(config, 's3.bucketName'),
        });

        AWS.config.update(s3Config);
        const s3 = new AWS.S3();

        logger.info('S3 클라이언트 생성 완료, 파일 읽기 시작', { filePath });

        fs.readFile(filePath, (err, data) => {
            if (err) {
                logger.error('S3 파일 읽기 실패', {
                    filePath,
                    error: err.message,
                    errorCode: err.code,
                });
                reject(new AppError(err));
                return;
            }

            logger.info('S3 파일 읽기 성공, 업로드 시작', {
                key,
                fileSize: data.length,
                bucketName: _.get(config, 's3.bucketName'),
            });

            s3.upload(
                {
                    Key: key,
                    Body: data,
                    ACL: 'public-read',
                    Bucket: _.get(config, 's3.bucketName'),
                },
                (error: Error, result: any) => {
                    if (error) {
                        logger.error('=== uploadFileToS3 실패 ===', {
                            key,
                            error: error.message,
                            errorStack: error.stack,
                            timestamp: new Date().toISOString(),
                        });
                        reject(new AppError(error));
                    } else {
                        logger.info('=== uploadFileToS3 성공 ===', { 
                            key,
                            location: result?.Location,
                            etag: result?.ETag,
                            timestamp: new Date().toISOString(),
                        });
                        resolve();
                    }
                },
            );
        });
    });
}

function uploadFileToOSS(key: string, filePath: string, logger: Logger): Promise<void> {
    logger.info('try uploadFileToOSS', { key });
    const ossStream = ALYOSSStream(
        new ALY.OSS({
            accessKeyId: _.get(config, 'oss.accessKeyId'),
            secretAccessKey: _.get(config, 'oss.secretAccessKey'),
            endpoint: _.get(config, 'oss.endpoint'),
            apiVersion: '2013-10-15',
        }),
    );
    if (!_.isEmpty(_.get(config, 'oss.prefix', ''))) {
        // eslint-disable-next-line no-param-reassign
        key = `${_.get(config, 'oss.prefix')}/${key}`;
    }
    const upload = ossStream.upload({
        Bucket: _.get(config, 'oss.bucketName'),
        Key: key,
    });

    return new Promise((resolve, reject) => {
        upload.on('error', (error) => {
            reject(new AppError(JSON.stringify(error)));
        });

        upload.on('uploaded', () => {
            logger.info('uploadFileToOSS success', { key });
            resolve();
        });
        fs.createReadStream(filePath).pipe(upload);
    });
}

function getUploadTokenQiniu(mac: qiniu.auth.digest.Mac, bucket: string, key: string) {
    const options = {
        scope: `${bucket}:${key}`,
    };
    const putPolicy = new qiniu.rs.PutPolicy(options);
    return putPolicy.uploadToken(mac);
}

function uploadFileToQiniu(key: string, filePath: string, logger: Logger): Promise<void> {
    return new Promise((resolve, reject) => {
        logger.info('try uploadFileToQiniu', { key });
        const accessKey = _.get(config, 'qiniu.accessKey');
        const secretKey = _.get(config, 'qiniu.secretKey');
        const bucket = _.get(config, 'qiniu.bucketName', '');
        const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        const conf = new qiniu.conf.Config();
        const bucketManager = new qiniu.rs.BucketManager(mac, conf);
        bucketManager.stat(bucket, key, (respErr, respBody, respInfo) => {
            if (respErr) {
                reject(new AppError(respErr.message));
                return;
            }
            if (respInfo.statusCode === 200) {
                logger.info('uploadFileToQiniu file exists, skip upload', { key });
                resolve();
                return;
            }

            let uploadToken: string;
            try {
                uploadToken = getUploadTokenQiniu(mac, bucket, key);
            } catch (e) {
                reject(new AppError(e.message));
                return;
            }
            const formUploader = new qiniu.form_up.FormUploader(conf);
            const putExtra = new qiniu.form_up.PutExtra();
            formUploader.putFile(
                uploadToken,
                key,
                filePath,
                putExtra,
                (resErr, resBody, resInfo) => {
                    if (resErr) {
                        // 上传失败， 处理返回代码
                        return reject(new AppError(resErr));
                    }
                    // 上传成功， 处理返回值
                    if (resInfo.statusCode === 200) {
                        logger.info('uploadFileToQiniu success', { key });
                        return resolve();
                    }
                    return reject(new AppError(resBody.error));
                },
            );
        });
    });
}

function uploadFileToTencentCloud(key: string, filePath: string, logger: Logger): Promise<void> {
    return new Promise((resolve, reject) => {
        logger.info('try uploadFileToTencentCloud', { key });
        const cosIn = new COS({
            SecretId: _.get(config, 'tencentcloud.accessKeyId'),
            SecretKey: _.get(config, 'tencentcloud.secretAccessKey'),
        });
        cosIn.sliceUploadFile(
            {
                Bucket: _.get(config, 'tencentcloud.bucketName'),
                Region: _.get(config, 'tencentcloud.region'),
                Key: key,
                FilePath: filePath,
            },
            (err) => {
                if (err) {
                    reject(new AppError(err.message));
                } else {
                    logger.info('uploadFileToTencentCloud success', { key });
                    resolve();
                }
            },
        );
    });
}

function uploadFileToGCS(key: string, filePath: string, logger: Logger): Promise<void> {
    return new Promise((resolve, reject) => {
        logger.info('=== uploadFileToGCS 시작 ===', { 
            key,
            filePath,
            timestamp: new Date().toISOString(),
        });
        
        const projectId = _.get(config, 'gcs.projectId');
        const keyFilename = _.get(config, 'gcs.keyFilename');
        const bucketName = _.get(config, 'gcs.bucketName');
        
        logger.info('GCS 설정 정보', {
            projectId,
            keyFilename,
            bucketName,
            hasKeyFilename: !!keyFilename,
            keyFilenameExists: keyFilename ? fs.existsSync(keyFilename) : false,
            googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            hasGoogleApplicationCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
        
        if (!projectId || !bucketName) {
            const errorMsg = 'GCS projectId and bucketName are required';
            logger.error('GCS 설정 오류', { 
                projectId, 
                bucketName, 
                errorMsg 
            });
            reject(new AppError(errorMsg));
            return;
        }
        
        let storage;
        try {
            const storageOptions = {
                projectId,
                ...(keyFilename && { keyFilename }),
            };
            
            logger.info('GCS Storage 인스턴스 생성 시도', { storageOptions });
            storage = new Storage(storageOptions);
            logger.info('GCS Storage 인스턴스 생성 성공');
        } catch (error) {
            logger.error('GCS Storage 인스턴스 생성 실패', {
                error: error.message,
                errorStack: error.stack,
            });
            reject(new AppError(`GCS Storage 초기화 실패: ${error.message}`));
            return;
        }
        
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(key);
        
        logger.info('GCS 버킷 및 파일 객체 생성 완료', {
            bucketName,
            key,
        });
        
        // Check if file already exists
        logger.info('GCS 파일 존재 여부 확인 시작', { key });
        file.exists()
            .then(([exists]) => {
                logger.info('GCS 파일 존재 여부 확인 완료', { 
                    key, 
                    exists,
                    timestamp: new Date().toISOString(),
                });
                
                if (exists) {
                    logger.info('uploadFileToGCS file exists, skip upload', { key });
                    resolve();
                    return;
                }
                
                // Upload file
                logger.info('GCS 파일 업로드 시작', {
                    key,
                    filePath,
                    fileSize: fs.statSync(filePath).size,
                    timestamp: new Date().toISOString(),
                });
                
                return bucket.upload(filePath, {
                    destination: key,
                    metadata: {
                        cacheControl: 'public, max-age=31536000',
                    },
                });
            })
            .then((uploadResult) => {
                if (uploadResult) {
                    logger.info('GCS 파일 업로드 완료', {
                        key,
                        uploadResult: uploadResult[0] ? {
                            name: uploadResult[0].name,
                            bucket: uploadResult[0].bucket.name,
                            generation: uploadResult[0].generation,
                        } : null,
                        timestamp: new Date().toISOString(),
                    });
                }
                logger.info('=== uploadFileToGCS 성공 ===', { 
                    key,
                    timestamp: new Date().toISOString(),
                });
                resolve();
            })
            .catch((error) => {
                logger.error('=== uploadFileToGCS 실패 ===', {
                    key,
                    filePath,
                    error: error.message,
                    errorCode: error.code,
                    errorStack: error.stack,
                    errorDetails: error.errors || [],
                    timestamp: new Date().toISOString(),
                });
                reject(new AppError(`GCS 업로드 실패: ${error.message}`));
            });
    });
}

export function uploadFileToStorage(rawKey: string, filePath: string, logger: Logger): Promise<void> {
    const { storageType } = config.common;

    const prefix = 'codepush-storage';
    const key = `${prefix}/${rawKey}`;

    // Cloud Run 디버깅을 위한 상세 로그 추가
    logger.info('=== uploadFileToStorage 시작 ===', {
        rawKey,
        filePath,
        storageType,
        finalKey: key,
        fileExists: fs.existsSync(filePath),
        fileStats: fs.existsSync(filePath) ? fs.statSync(filePath) : null,
        configKeys: Object.keys(config),
        commonConfig: config.common,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        cloudRunService: process.env.K_SERVICE,
        cloudRunRevision: process.env.K_REVISION,
    });

    // 파일 존재 여부 및 접근 권한 확인
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        logger.info('파일 접근 권한 확인 성공', { filePath });
    } catch (error) {
        logger.error('파일 접근 권한 확인 실패', { 
            filePath, 
            error: error.message,
            errorCode: error.code 
        });
        throw new AppError(`파일 접근 실패: ${error.message}`);
    }

    // 스토리지 타입별 설정 확인
    let storageConfig = {};
    switch (storageType) {
        case 'local':
            storageConfig = { localConfig: config.local };
            break;
        case 's3':
            storageConfig = { 
                s3Config: {
                    hasAccessKeyId: !!_.get(config, 's3.accessKeyId'),
                    hasSecretAccessKey: !!_.get(config, 's3.secretAccessKey'),
                    region: _.get(config, 's3.region'),
                    bucketName: _.get(config, 's3.bucketName'),
                }
            };
            break;
        case 'oss':
            storageConfig = {
                ossConfig: {
                    hasAccessKeyId: !!_.get(config, 'oss.accessKeyId'),
                    hasSecretAccessKey: !!_.get(config, 'oss.secretAccessKey'),
                    endpoint: _.get(config, 'oss.endpoint'),
                    bucketName: _.get(config, 'oss.bucketName'),
                    prefix: _.get(config, 'oss.prefix'),
                }
            };
            break;
        case 'qiniu':
            storageConfig = {
                qiniuConfig: {
                    hasAccessKey: !!_.get(config, 'qiniu.accessKey'),
                    hasSecretKey: !!_.get(config, 'qiniu.secretKey'),
                    bucketName: _.get(config, 'qiniu.bucketName'),
                }
            };
            break;
        case 'tencentcloud':
            storageConfig = {
                tencentcloudConfig: {
                    hasAccessKeyId: !!_.get(config, 'tencentcloud.accessKeyId'),
                    hasSecretAccessKey: !!_.get(config, 'tencentcloud.secretAccessKey'),
                    region: _.get(config, 'tencentcloud.region'),
                    bucketName: _.get(config, 'tencentcloud.bucketName'),
                }
            };
            break;
        case 'gcs':
            storageConfig = {
                gcsConfig: {
                    projectId: _.get(config, 'gcs.projectId'),
                    hasKeyFilename: !!_.get(config, 'gcs.keyFilename'),
                    bucketName: _.get(config, 'gcs.bucketName'),
                    keyFilename: _.get(config, 'gcs.keyFilename'),
                }
            };
            break;
    }

    logger.info('스토리지 설정 확인', {
        storageType,
        ...storageConfig,
    });

    const uploadPromise = (() => {
        switch (storageType) {
            case 'local':
                return uploadFileToLocal(key, filePath, logger);
            // case 's3':
            //     return uploadFileToS3(key, filePath, logger);
            // case 'oss':
            //     return uploadFileToOSS(key, filePath, logger);
            // case 'qiniu':
            //     return uploadFileToQiniu(key, filePath, logger);
            // case 'tencentcloud':
            //     return uploadFileToTencentCloud(key, filePath, logger);
            case 'gcs':
                return uploadFileToGCS(key, filePath, logger);
            default:
                throw new AppError(`${storageType} storageType does not support.`);
        }
    })();

    return uploadPromise
        .then(() => {
            logger.info('=== uploadFileToStorage 성공 ===', {
                rawKey,
                finalKey: key,
                storageType,
                timestamp: new Date().toISOString(),
            });
        })
        .catch((error) => {
            logger.error('=== uploadFileToStorage 실패 ===', {
                rawKey,
                finalKey: key,
                storageType,
                error: error.message,
                errorStack: error.stack,
                timestamp: new Date().toISOString(),
            });
            throw error;
        });
}

# GCP Storage를 사용한 CodePush 서버 운영 가이드

이 가이드는 Google Cloud Storage를 사용하여 CodePush 서버를 처음부터 설정하고 운영하는 완전한 단계별 과정을 제공합니다.

## 🚀 준비사항

- Google Cloud 계정 (무료 체험판 가능)
- Docker 및 Docker Compose 설치
- 터미널/명령줄 액세스

## 1단계: GCP 프로젝트 설정

### 1.1 GCP 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/)에 로그인
2. **프로젝트 선택** → **새 프로젝트**
3. 프로젝트 이름 입력 (예: `my-codepush-project`)
4. **만들기** 클릭

### 1.2 결제 계정 설정 (필수)

1. **탐색 메뉴** → **결제**
2. 결제 계정 연결 (무료 크레딧 사용 가능)

### 1.3 Cloud Storage API 활성화

1. **탐색 메뉴** → **API 및 서비스** → **라이브러리**
2. "Cloud Storage API" 검색
3. **사용 설정** 클릭

## 2단계: Cloud Storage 버킷 생성

### 2.1 버킷 생성

```bash
# gcloud CLI 설치 및 로그인
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 버킷 생성 (버킷 이름은 전 세계적으로 고유해야 함)
gsutil mb gs://my-codepush-storage-bucket
```

또는 웹 콘솔에서:
1. **탐색 메뉴** → **Cloud Storage** → **버킷**
2. **버킷 만들기**
3. 버킷 이름: `my-codepush-storage-bucket`
4. 위치: 가까운 지역 선택
5. **만들기**

### 2.2 버킷 공개 읽기 권한 설정

```bash
# 공개 읽기 권한 부여
gsutil iam ch allUsers:objectViewer gs://my-codepush-storage-bucket
```

## 3단계: 서비스 계정 설정

### 3.1 서비스 계정 생성

1. **탐색 메뉴** → **IAM 및 관리자** → **서비스 계정**
2. **서비스 계정 만들기**
3. 이름: `codepush-storage-service`
4. **만들기 및 계속하기**

### 3.2 권한 부여

다음 역할 추가:
- `Storage Object Admin` 또는
- `Storage Object Creator` + `Storage Object Viewer`

### 3.3 서비스 계정 키 생성

1. 생성된 서비스 계정 클릭
2. **키** 탭 → **키 추가** → **새 키 만들기**
3. **JSON** 선택 → **만들기**
4. 다운로드된 JSON 파일을 `gcs-service-account-key.json`으로 저장

## 4단계: 프로젝트 설정

### 4.1 프로젝트 클론 및 설정

```bash
# 프로젝트 클론
git clone https://github.com/shm-open/code-push-server.git
cd code-push-server

# 서비스 계정 키 파일 복사
cp /path/to/downloaded/service-account-key.json ./gcs-service-account-key.json
```

### 4.2 환경 설정 파일 수정

`docker-compose.yml` 파일에서 다음 값들을 실제 값으로 변경:

```yaml
environment:
  # 실제 값으로 변경
  GCS_PROJECT_ID: 'my-codepush-project'
  GCS_BUCKET_NAME: 'my-codepush-storage-bucket'
  GCS_DOWNLOAD_URL: 'https://storage.googleapis.com/my-codepush-storage-bucket'
  
  # 서버 설정
  DOWNLOAD_URL: 'http://YOUR_SERVER_IP:3000/download'
  TOKEN_SECRET: 'GENERATE_RANDOM_63_CHARS_TOKEN'
```

### 4.3 JWT 토큰 시크릿 생성

1. [GRC 패스워드 생성기](https://www.grc.com/passwords.htm) 방문
2. "63 random alpha-numeric characters" 복사
3. `TOKEN_SECRET`에 붙여넣기

## 5단계: 서버 배포

### 5.1 Docker Compose로 서버 시작

```bash
# 백그라운드에서 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f server
```

### 5.2 서비스 상태 확인

```bash
# 컨테이너 상태 확인
docker-compose ps

# 서버 응답 테스트
curl -I http://localhost:3000/
```

정상적이면 `HTTP/1.1 200 OK` 응답

## 6단계: 초기 설정

### 6.1 웹 인터페이스 접속

1. 브라우저에서 `http://YOUR_SERVER_IP:3000` 접속
2. 기본 계정으로 로그인:
   - **계정**: `admin`
   - **비밀번호**: `123456`

### 6.2 비밀번호 변경 (중요!)

1. 로그인 후 설정 페이지 이동
2. 관리자 비밀번호 변경

## 7단계: GCS 업로드 테스트

### 7.1 테스트 스크립트 실행

```bash
# 환경변수 설정 후 테스트
GCS_PROJECT_ID=my-codepush-project \
GCS_BUCKET_NAME=my-codepush-storage-bucket \
npm run test:gcs
```

### 7.2 수동 테스트

1. CodePush CLI 설치:
```bash
npm install -g @shm-open/code-push-cli
```

2. 서버 등록:
```bash
code-push login http://YOUR_SERVER_IP:3000
```

3. 앱 생성 및 배포 테스트:
```bash
code-push app add MyApp-iOS ios react-native
code-push release-react MyApp-iOS ios
```

## 8단계: 모니터링 및 관리

### 8.1 로그 모니터링

```bash
# 서버 로그
docker-compose logs -f server

# 데이터베이스 로그
docker-compose logs -f mysql

# Redis 로그
docker-compose logs -f redis
```

### 8.2 GCS 사용량 모니터링

1. [Cloud Console Storage](https://console.cloud.google.com/storage) 방문
2. 버킷 클릭 → **모니터링** 탭
3. 사용량 및 요청 수 확인

### 8.3 백업 설정

```bash
# 데이터베이스 백업
docker-compose exec mysql mysqldump -u codepush -p123456 codepush > backup.sql

# 설정 파일 백업
cp docker-compose.yml docker-compose.yml.backup
cp gcs-service-account-key.json gcs-service-account-key.json.backup
```

## 9단계: 프로덕션 최적화

### 9.1 HTTPS 설정

```yaml
# docker-compose.yml에 nginx 프록시 추가
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - server
```

### 9.2 환경별 설정 분리

```bash
# 환경별 docker-compose 파일 생성
cp docker-compose.yml docker-compose.prod.yml

# 프로덕션 배포
docker-compose -f docker-compose.prod.yml up -d
```

### 9.3 자동 업데이트 설정

```bash
# Watchtower로 자동 업데이트
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 3600
```

## 🔧 문제 해결

### 공통 문제

1. **인증 오류**
   - 서비스 계정 키 파일 경로 확인
   - 서비스 계정 권한 확인

2. **버킷 접근 불가**
   - 버킷 이름이 올바른지 확인
   - 공개 읽기 권한 설정 확인

3. **업로드 실패**
   - GCS API 활성화 여부 확인
   - 네트워크 연결 확인

### 로그 분석

```bash
# 서버 로그에서 GCS 관련 오류 찾기
docker-compose logs server | grep -i gcs

# 디버그 모드로 실행
LOG_LEVEL=debug docker-compose up
```

## 📈 성능 최적화

1. **CDN 설정**: Cloud CDN 연결
2. **캐싱**: Redis 캐시 설정 최적화
3. **스케일링**: 다중 인스턴스 배포

## 💰 비용 최적화

1. **Storage Class**: 접근 빈도에 따라 Nearline/Coldline 사용
2. **Lifecycle**: 오래된 파일 자동 삭제 정책
3. **모니터링**: 비용 알림 설정

## 🔐 보안 강화

1. **방화벽**: Cloud Armor 설정
2. **VPC**: 네트워크 격리
3. **키 로테이션**: 정기적인 서비스 계정 키 교체

이제 GCP Storage를 사용한 CodePush 서버가 완전히 운영 준비되었습니다! 🎉 
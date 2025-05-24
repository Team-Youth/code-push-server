import { createClient, RedisClientType } from 'redis';
import { Sequelize } from 'sequelize';
import { config } from '../config';

export const sequelize = new Sequelize(
    config.db.database,
    config.db.username,
    config.db.password,
    config.db,
);

let redisClientExport: RedisClientType;

// Redis를 사용하는 기능이 하나라도 활성화되어 있는지 확인
const shouldUseRedis = 
    config.common.tryLoginTimes > 0 || 
    config.common.updateCheckCache || 
    config.common.rolloutClientUniqueIdCache;

if (shouldUseRedis) {
    const client = createClient({
        socket: {
            host: config.redis.host,
            port: config.redis.port,
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    return new Error('Retry count exhausted');
                }
                return retries * 100;
            },
        },
        password: config.redis.password,
        database: config.redis.db,
    });

    client.on('error', (err) => console.error('Redis Client Error', err));

    client.connect().catch(err => {
        console.error('Failed to connect to Redis:', err);
        // Redis 연결 실패 시, redisClientExport를 undefined로 두어
        // 이후 코드에서 redisClient 사용 시 오류가 발생하도록 함 (또는 다른 예외 처리)
    });
    redisClientExport = client as RedisClientType;
} else {
    // Redis를 사용하지 않는 경우, redisClient를 mock 객체 또는 undefined로 설정할 수 있습니다.
    // 여기서는 간단하게 console.log로 대체하고, 실제 사용처에서 null check를 가정합니다.
    console.log('Redis is not configured. Skipping Redis connection.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redisClientExport = null as any; // 실제 사용 시 주의 필요
}

export const redisClient = redisClientExport;

# CodePush 서버 비용 최적화 가이드

## 🎯 Redis 없이 운영하기

CodePush 서버는 **Redis 없이도 완전히 정상 작동**합니다! Redis는 성능 향상과 보안 기능을 제공하지만 필수는 아닙니다.

### Redis 사용 용도와 대안

| 기능 | Redis 역할 | Redis 없을 때 | 추천 설정 |
|------|------------|---------------|-----------|
| 로그인 시도 제한 | 브루트포스 방지 | 무제한 시도 가능 | `TRY_LOGIN_TIMES=0` |
| 업데이트 체크 캐싱 | 10분간 결과 캐싱 | 매번 DB 조회 | `UPDATE_CHECK_CACHE=false` |
| 롤아웃 캐싱 | 사용자별 배포 대상 캐싱 | 매번 랜덤 계산 | `ROLLOUT_CLIENT_UNIQUE_ID_CACHE=false` |

### 성능 영향 분석

#### ✅ 영향 없음
- 앱 배포/다운로드
- 사용자 관리
- 배포 기록 조회
- CLI 명령어 모든 기능

#### ⚠️ 약간의 성능 저하
- **업데이트 체크**: 캐시 없이 매번 DB 조회 (100ms → 200ms 정도)
- **점진적 배포**: 매번 랜덤 계산 (1ms → 5ms 정도)

#### 🔓 보안 약화
- **로그인 시도 제한 없음**: 브루트포스 공격에 취약
- **대안**: 웹 방화벽(WAF) 또는 Cloud Load Balancer의 DDoS 보호 활용

## 💰 비용 최적화 전략

### 1. Cloud Run Only (월 $15-30)
```bash
# 가장 경제적인 옵션
- Cloud Run: $15-25/월
- Cloud SQL (MySQL): $10-15/월  
- Cloud Storage: $1-3/월
- 총합: $26-43/월
```

### 2. 성능이 중요한 경우 (월 $30-50)
```bash
# Memorystore (Redis 관리형) 추가
- Cloud Run: $15-25/월
- Cloud SQL: $10-15/월
- Memorystore Redis: $15-25/월
- Cloud Storage: $1-3/월
- 총합: $41-68/월
```

### 3. DIY 최저비용 (월 $10-20)
```bash
# Compute Engine VM 직접 관리
- e2-micro VM: $5-8/월
- Cloud SQL: $10-15/월
- Cloud Storage: $1-3/월
- 총합: $16-26/월
```

## 🚀 추천 시작 방법

### 단계 1: Redis 없이 시작
```bash
# 현재 설정으로 배포
./deploy-to-cloudrun.sh
```

### 단계 2: 트래픽 모니터링
- Cloud Monitoring으로 응답시간 확인
- 사용자 수와 업데이트 빈도 측정

### 단계 3: 필요시 Redis 추가
```bash
# Memorystore Redis 생성
gcloud redis instances create codepush-redis \
  --size=1 \
  --region=asia-northeast3 \
  --redis-version=redis_6_x

# 환경변수 업데이트
gcloud run services update codepush-server \
  --set-env-vars="REDIS_HOST=REDIS_IP" \
  --set-env-vars="TRY_LOGIN_TIMES=5" \
  --set-env-vars="UPDATE_CHECK_CACHE=true" \
  --set-env-vars="ROLLOUT_CLIENT_UNIQUE_ID_CACHE=true"
```

## 📊 사용량별 권장사항

### 🔹 소규모 팀 (1-10명 개발자)
- **추천**: Redis 없이 Cloud Run
- **비용**: 월 $26-43
- **이유**: 트래픽이 적어 성능 차이 미미

### 🔸 중간 규모 (10-50명 개발자)
- **추천**: Cloud Run + Memorystore
- **비용**: 월 $41-68
- **이유**: 업데이트 체크 빈도 증가로 캐싱 효과

### 🔶 대규모 (50명+ 개발자)
- **추천**: GKE + Redis Cluster
- **비용**: 월 $100+
- **이유**: 확장성과 고가용성 필요

## 🛡️ 보안 강화 방법 (Redis 없이)

### 1. Cloud Load Balancer 사용
```bash
# DDoS 보호 및 속도 제한
gcloud compute backend-services create codepush-backend \
  --global \
  --load-balancing-scheme=EXTERNAL \
  --protocol=HTTP
```

### 2. Cloud Armor 적용
```bash
# WAF 규칙으로 브루트포스 방지
gcloud compute security-policies create codepush-policy \
  --description="CodePush server protection"
```

### 3. 강력한 패스워드 정책
```javascript
// 애플리케이션 레벨에서 구현
PASSWORD_MIN_LENGTH=12
REQUIRE_SPECIAL_CHARS=true
```

## ✅ 결론

**Redis는 선택사항입니다!**

1. **시작**: Redis 없이 배포하여 비용 절약
2. **모니터링**: 성능과 보안 요구사항 확인  
3. **필요시 추가**: 트래픽 증가 시 Redis 도입

대부분의 소규모-중간 규모 프로젝트에서는 Redis 없이도 충분히 만족스러운 성능을 얻을 수 있습니다. 
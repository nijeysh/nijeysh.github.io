# 블로그 포스팅 할 일 (TODO List)

## 📌 기술 포스팅 아이디어 (Idea)
- [ ] **서버 간 트랜잭션 전파 및 가시성 문제 (A server -> B server)**
  - **카테고리**: `spring`, `database`
  - **상세 내용**: 
    - 동일한 DB를 바라보는 두 서버(A, B) 간의 레이스 컨디션 문제.
    - 서버 A에서 데이터를 저장(Save)하고 아직 트랜잭션이 커밋되지 않은 상태에서 서버 B의 API를 호출.
    - 서버 B는 API를 받았지만, DB에서는 서버 A가 생성한 레코드를 아직 인식하지 못하는 현상 (Transactional Isolation/Commit 시점 문제).
  - **작성 계기**: 
    - 동료가 실무에서 마주한 이 이슈를 계기로 트랜잭션의 특성이나 격리 수준 등에 대해 명확하게 다시 한번 짚어보고 깊게 공부하기 위해 작성함.
  - **학습 포인트**: `@Transactional` 동작 방식, Transaction Isolation Level, 서버 간 API 호출 시점 제어 방법 등.

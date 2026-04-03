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

- [ ] **Java 대용량 파일 처리와 Garbage Collection (GC) 최적화**
  - **카테고리**: `java`, `jvm`, `performance`
  - **상세 내용**: 
    - `BufferedInputStream`, `BufferedOutputStream`을 사용한 대용량 파일 읽기/쓰기 시 발생하는 메모리 증가 문제 해결.
    - 대량의 데이터를 처리할 때 GC가 어떻게 동작하는지, 메모리 누수를 방지하기 위한 전략 조사.
  - **작성 계기**: 
    - 최근 대용량 파일 데이터 처리를 개발하면서 메모리 사용량이 계속 증가하는 현상을 경험함. 효율적인 메모리 관리를 위해 GC에 대한 깊이 있는 공부가 필요하다고 판단됨.
  - **학습 포인트**: GC 알고리즘(G1GC, ZGC 등), JVM Heap/Non-heap 구조, 스트림의 버퍼링 및 라이프사이클 관리, 대용량 처리 시의 메모리 모니터링 기법.

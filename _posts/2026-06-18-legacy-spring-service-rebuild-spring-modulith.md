---
layout: post
title: "스크래핑 서비스 재구성하기 - Spring Modulith를 고민하는 이유"
date: 2026-06-18
category: spring
tags: [spring, architecture, spring-modulith, scraping, batch, react]
published: false
---

3년 전에 런칭된 서비스를 유지보수하게 되었다.  
서비스는 돌아가고 있었지만, 코드를 열어볼수록 "이걸 계속 고쳐가면서 쓰는 게 맞나?"라는 생각이 들었다.

기능 하나를 추가하려고 해도 어디까지 건드려야 하는지 바로 보이지 않았고, 장애가 나면 원인을 따라가는 과정도 꽤 피곤했다.  
처음 개발할 당시에는 일정이나 상황 때문에 어쩔 수 없는 선택들이 있었겠지만, 지금 유지보수를 맡은 입장에서는 이 구조를 그대로 끌고 가는 비용이 더 커 보였다.

그래서 처음에는 아예 프로젝트를 갈아엎고, 기능만 유지한 채 내부 구조를 다시 잡는 방향을 생각했다.

이 글은 그 과정에서 했던 고민을 정리한 글이다.  
처음에는 Gradle 멀티모듈을 생각했는데, 지금은 Spring Modulith 쪽으로 생각이 바뀌었다.

---

## 기존 구조

기존 프로젝트는 이름상으로는 `FE`와 `BE`가 나뉘어 있었다.

그런데 보통 말하는 프론트엔드와 백엔드 분리가 아니었다.

- FE 프로젝트: Spring Boot + Thymeleaf + Security
- BE 프로젝트: Spring Boot + DB 접근
- Batch: BE 프로젝트 내부 스케줄 기능

즉, FE도 Spring이고 BE도 Spring이었다.  
FE 프로젝트는 화면을 렌더링하고 인증을 처리하고, 실제 데이터가 필요하면 BE 프로젝트를 호출하는 식이었다.

단순화하면 이런 구조다.

```text
Browser
  -> Spring FE
      -> Spring BE
          -> DB

Spring BE
  -> Scheduler
  -> DB
```

처음 봤을 때는 "아 FE/BE를 나누긴 했구나" 싶었는데, 자세히 보면 프론트와 백엔드를 나눴다기보다는 Spring 서버를 두 개로 쪼개놓은 형태에 가까웠다.

물론 Thymeleaf나 서버 사이드 렌더링 자체가 문제라는 뜻은 아니다.  
문제는 이 서비스에서는 화면, 인증, API 중계, DB 처리, 스케줄 작업의 책임이 애매하게 흩어져 있었다는 점이다.

이런 구조에서는 변경 비용이 계속 커진다.

- 화면 변경인데 Spring FE를 봐야 한다.
- 데이터 변경인데 Spring FE와 Spring BE의 호출 흐름을 같이 봐야 한다.
- 인증 책임이 어디까지 FE에 있고 어디부터 BE에 있는지 애매하다.
- 요청이 서버를 한 번 더 거치면서 장애 지점이 늘어난다.
- Batch가 BE 안에 같이 있어서 API와 배치의 부하가 섞인다.

그래서 기존 구조를 조금씩 고치는 것보다, 책임을 다시 나누는 게 맞다고 봤다.

---

## 이 서비스가 하는 일

우리가 다루는 서비스는 스크래핑을 자주 사용하는 서비스다.  
흐름을 단순화하면 대략 이렇다.

```text
1. 클라이언트가 특정 수집 문서를 요청한다.
2. 기관별로 간편인증이나 공동인증서 인증이 필요한 경우 인증을 진행한다.
3. 인증이 완료되면 쿠키나 세션 같은 값을 DB에 저장한다.
4. polling 방식으로 스크래핑 요청 테이블을 조회한다.
5. 스케줄러가 대상 작업을 찾아 자사 스크래핑 엔진 또는 API에 요청한다.
6. 스크래핑 결과를 PDF, XLSX 같은 파일로 만든다.
7. 생성된 파일을 서버에 저장한다.
8. 클라이언트는 생성된 파일을 확인하거나 저장한다.
```

처음에는 이 흐름이 그냥 하나의 긴 작업처럼 보였다.  
그래서 기존 코드도 `batch` 같은 패키지 안에 `@Scheduled`를 두고, 주기적으로 DB를 조회해서 처리하는 방식이었다.

문제는 시간이 지나면서 스케줄러가 너무 많은 걸 알게 됐다는 점이다.

```text
Scheduler
  -> 스크래핑 요청 테이블 조회
  -> 인증 완료 여부 확인
  -> 세션/쿠키 조회
  -> 스크래핑 엔진/API 호출
  -> 결과 수신
  -> PDF/XLSX 생성
  -> 파일 저장
  -> 요청 상태 변경
```

처음에는 단순한 polling 작업이었는데, 점점 전체 비즈니스 흐름을 다 아는 중심 클래스가 되어버렸다.

이게 내가 제일 찝찝했던 부분이다.  
배치가 같은 프로젝트에 있다는 것보다, **스케줄러가 인증, 스크래핑, 문서 생성, 파일 저장까지 전부 알고 있다는 것**이 더 큰 문제였다.

클래스들도 자연스럽게 서로 엮였다.  
스크래핑 요청을 처리하는 클래스가 인증 테이블을 알고, 파일 생성 클래스가 요청 상태를 바꾸고, 스케줄러가 PDF 생성까지 호출하는 식이었다.

그러다 보니 기능 하나를 고치려고 해도 어디까지 영향이 갈지 바로 보이지 않았다.

---

## 처음 생각했던 방향

처음에는 이렇게 생각했다.

```text
repository/
  frontend/     # React

  backend/
    apps/
      api/
      batch/

    modules/
      domain/
      application/
      infrastructure/
      common/
```

프론트는 React로 빼고, 백엔드는 Gradle 멀티모듈로 구성하는 방식이다.  
API 서버와 Batch 서버를 각각 실행 애플리케이션으로 두고, 공통 도메인이나 인프라 코드는 모듈로 공유하면 깔끔해 보였다.

이 방식이 틀렸다고 생각하지는 않는다.  
API와 Batch가 진짜로 배포 단위부터 다르고, 공통 코드도 어느 정도 안정되어 있다면 충분히 괜찮은 선택이다.

그런데 다시 생각해보니 지금 우리 상황에서는 바로 멀티모듈로 가는 게 조금 부담스러웠다.

---

## 멀티모듈이 애매했던 이유

멀티모듈은 코드를 물리적으로 나누는 방식이다.  
Gradle 프로젝트 단위가 나뉘고, 각 모듈의 의존성을 빌드 레벨에서 관리한다.

이게 장점이기도 하지만, 레거시를 재구성하는 초반에는 부담이 될 수도 있다.

아직 도메인 경계가 명확하지 않은 상태에서 모듈부터 나눠버리면 이런 일이 생긴다.

- 이 코드가 어느 모듈에 있어야 하는지 계속 고민하게 된다.
- 공통 모듈이 점점 커질 수 있다.
- 모듈 간 의존성이 생각보다 빨리 꼬일 수 있다.
- 구조를 바꾸는 비용이 빌드 구조 변경 비용까지 같이 커진다.
- 실제 문제는 패키지 의존성인데, 해결책은 프로젝트 분리로 과해질 수 있다.

특히 지금 서비스는 "이미 도메인이 잘 나뉘어 있는데 빌드만 정리하면 되는 상태"가 아니다.  
오히려 먼저 해야 할 일은 도메인과 기능 경계를 찾는 것이다.

그래서 멀티모듈보다 먼저 Spring Modulith를 적용하는 쪽으로 생각이 바뀌었다.

---

## MSA 전 단계로만 봐야 할까

Spring Modulith를 찾아보면서 처음 든 생각은 이거였다.

> 이거 그냥 MSA 가기 전에 고려하는 중간 단계인가?

결론부터 말하면, 꼭 그렇게만 볼 필요는 없다고 생각했다.

Spring Modulith는 MSA를 도입하기 위한 예비 단계라기보다는, 하나의 Spring Boot 애플리케이션 안에서 도메인 경계를 명확하게 세우기 위한 방식에 가깝다.

물론 나중에 MSA로 갈 수도 있다.  
하지만 지금 당장 우리 서비스가 MSA가 필요한지는 잘 모르겠다.

MSA로 가면 서비스 분리, 배포 분리, DB 분리, 네트워크 통신, 장애 전파, 모니터링까지 한 번에 고민해야 한다.  
지금 필요한 건 그런 물리적인 분리보다, 먼저 코드 안에서 책임을 제대로 나누는 것이다.

그래서 지금 우리 상황에서는 MSA보다 모듈러 모놀리스가 더 현실적이라고 봤다.

```text
React
  -> Spring Boot Backend
      -> collectionrequest
      -> authentication
      -> scraping
      -> scrapingengine
      -> document
      -> filestorage
      -> scheduler
```

배포는 하나로 가져가되, 내부에서는 아무 모듈이나 아무 클래스나 참조하지 못하게 경계를 잡는 방식이다.

---

## Spring Modulith로 가려는 이유

Spring Modulith는 한 Spring Boot 애플리케이션 안에서 애플리케이션 모듈을 나누고, 그 경계를 검증할 수 있게 도와주는 도구다.

내가 좋게 본 지점은 이거다.

**물리적으로 프로젝트를 쪼개기 전에, 논리적인 모듈 경계를 먼저 세울 수 있다.**

즉, 처음부터 `api`, `batch`, `domain`, `application`, `infrastructure` 같은 Gradle 모듈을 만드는 대신, 하나의 Spring Boot 프로젝트 안에서 패키지 기준으로 기능 모듈을 나눈다.

예를 들면 이런 식이다.

```text
src/main/java/com/company/scraping/
  Application.java

  collectionrequest/
    CollectionRequestService.java
    CollectionRequestRepository.java
    internal/
      CollectionRequestValidator.java

  authentication/
    AuthenticationService.java
    AuthSessionReader.java
    internal/
      AuthSessionRepository.java
      SimpleAuthClient.java

  scraping/
    ScrapingJobService.java
    ScrapingJobRepository.java
    internal/
      ScrapingJobSelector.java

  scrapingengine/
    ScrapingEngineClient.java
    internal/
      InternalScrapingApiClient.java

  document/
    DocumentGenerateService.java
    internal/
      PdfGenerator.java
      XlsxGenerator.java

  filestorage/
    FileStorageService.java
    StoredFileRepository.java

  scheduler/
    ScrapingPollingScheduler.java
```

Spring Modulith는 기본적으로 Spring Boot 애플리케이션의 메인 패키지 아래 직접 하위 패키지를 애플리케이션 모듈로 본다.  
위 구조라면 `collectionrequest`, `authentication`, `scraping`, `scrapingengine`, `document`, `filestorage`, `scheduler`가 각각 모듈이 된다.

각 모듈은 외부에 공개할 API와 내부 구현을 구분한다.  
예를 들어 `authentication` 모듈 밖에서는 `authentication.internal`에 직접 접근하지 않는 식으로 경계를 잡을 수 있다.

이게 좋은 이유는 단순하다.

코드를 한 프로젝트 안에 두면서도, "아무 데서나 아무 클래스나 가져다 쓰는 구조"를 막을 수 있기 때문이다.

---

## 내가 원하는 구조

현재 기준으로는 이렇게 가는 게 더 현실적이라고 본다.

```text
repository/
  frontend/       # React

  backend/        # Spring Boot + Spring Modulith
    src/main/java/...
```

런타임 기준으로는 다음처럼 나눈다.

```text
Browser
  -> React
  -> Spring API
      -> DB / Redis / External API
```

그리고 백엔드 내부는 Spring Modulith 기준으로 기능 모듈을 나눈다.

```text
backend
  collectionrequest
  authentication
  scraping
  scrapingengine
  document
  filestorage
  scheduler
```

이렇게 하면 당장 얻을 수 있는 장점이 있다.

- 배포 단위는 단순하게 유지할 수 있다.
- 패키지 구조만으로도 기능 경계를 드러낼 수 있다.
- 모듈 간 잘못된 의존성을 테스트로 잡을 수 있다.
- 나중에 진짜 분리해야 할 모듈이 보이면 그때 멀티모듈이나 별도 서비스로 뺄 수 있다.
- 레거시를 한 번에 크게 쪼개는 부담을 줄일 수 있다.

처음부터 멀티모듈을 만들면 구조가 좋아지는 것처럼 보일 수 있다.  
하지만 모듈 경계가 애매한 상태에서는 멀티모듈도 결국 복잡한 폴더 나누기가 될 수 있다.

지금은 "빌드 모듈을 나누는 것"보다 "업무 기능의 경계를 찾는 것"이 먼저라고 생각했다.

---

## 지금 기준으로 나눠보고 싶은 모듈

스크래핑 서비스 기준으로는 모듈을 이렇게 나눠보고 싶다.

| 모듈 | 책임 |
|---|---|
| `collectionrequest` | 클라이언트의 문서 수집 요청을 받고 요청 상태를 관리한다. |
| `authentication` | 간편인증, 공동인증서 인증 흐름과 인증 세션/쿠키를 관리한다. |
| `scraping` | 스크래핑 작업을 생성하고 실행 상태, 실패, 재시도를 관리한다. |
| `scrapingengine` | 자사 스크래핑 엔진 또는 스크래핑 API 호출을 담당한다. |
| `document` | 스크래핑 결과를 PDF, XLSX 같은 문서로 변환한다. |
| `filestorage` | 생성된 파일 저장과 파일 메타데이터를 관리한다. |
| `scheduler` | polling으로 실행 가능한 작업을 깨우는 역할만 한다. |

여기서 중요한 건 `scheduler`를 비즈니스 중심으로 두지 않는 것이다.

기존에는 스케줄러가 이런 흐름을 직접 알고 있었다.

```java
@Scheduled(fixedDelay = 5000)
public void run() {
    // 요청 조회
    // 인증 상태 확인
    // 쿠키 조회
    // 스크래핑 요청
    // PDF 생성
    // 파일 저장
    // 상태 변경
}
```

이렇게 두면 스케줄러가 전체 업무 흐름의 주인이 된다.  
나는 이 구조를 바꾸고 싶다.

스케줄러는 정말 작업을 깨우는 정도만 알아야 한다.

```java
@Scheduled(fixedDelay = 5000)
public void poll() {
    scrapingJobService.processRunnableJobs();
}
```

그리고 실제 흐름은 `scraping` 모듈이나 각 모듈의 이벤트 핸들러가 가져가는 방식이 더 낫다고 생각한다.

```text
CollectionRequested
  -> AuthenticationRequested
  -> AuthenticationCompleted
  -> ScrapingJobCreated
  -> ScrapingCompleted
  -> DocumentGenerated
  -> FileStored
```

지금 polling을 바로 이벤트 기반으로 바꾸겠다는 뜻은 아니다.  
외부 메시지 브로커를 도입하거나 Kafka 같은 걸 붙이려는 것도 아니다.

우선은 DB polling을 유지하더라도, 애플리케이션 내부 흐름은 모듈 간 직접 호출을 줄이고 이벤트로 느슨하게 연결할 수 있는지 보고 싶다.

---

## 상태 흐름도 먼저 정리해야 한다

이 서비스는 단계가 길기 때문에 상태를 대충 두면 금방 꼬일 것 같다.

예를 들면 이런 상태가 필요할 수 있다.

```text
REQUESTED
AUTH_REQUIRED
AUTH_PENDING
AUTH_COMPLETED
READY_TO_SCRAPE
SCRAPING
SCRAPING_COMPLETED
DOCUMENT_GENERATING
FILE_STORED
COMPLETED
FAILED
```

물론 실제 상태는 더 줄이거나 나눌 수 있다.  
중요한 건 각 모듈이 아무 때나 상태를 바꾸지 않게 하는 것이다.

예를 들어 `document` 모듈이 문서를 생성했다고 해서 수집 요청의 전체 상태를 마음대로 바꾸면 안 된다.  
`document`는 "문서 생성이 완료됐다"는 사실을 알리고, 최종 상태 전이는 그 책임을 가진 모듈이 처리하는 게 낫다.

이런 기준을 세워두지 않으면 Modulith를 써도 결국 예전처럼 서로의 테이블과 서비스를 마음대로 건드리는 구조가 될 수 있다.

---

## 모듈 검증을 테스트로 잡기

Spring Modulith에서 가장 기대하는 부분은 구조 검증이다.

예를 들어 테스트에서 이런 식으로 애플리케이션 모듈 구조를 검증할 수 있다.

```java
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {

    @Test
    void verifiesModularStructure() {
        ApplicationModules.of(Application.class).verify();
    }
}
```

이 테스트는 모듈 간 순환 참조가 있는지, 다른 모듈의 내부 패키지를 침범하고 있지는 않은지 등을 확인한다.

레거시 코드에서 가장 무서운 건 사실 "지금은 돌아가는데 왜 돌아가는지 모르는 상태"라고 생각한다.  
이런 검증 테스트가 있으면 최소한 구조가 망가지고 있는지 아닌지를 계속 확인할 수 있다.

내가 원하는 건 거창한 아키텍처 선언이 아니다.  
앞으로 코드를 고칠 때 "이 방향으로 가면 안 된다"를 자동으로 잡아주는 안전장치가 필요하다.

---

## 모듈 간 직접 호출을 줄이기

Spring Modulith를 보면서 또 괜찮다고 느낀 부분은 이벤트 기반 모듈 통신이다.

기존 코드는 보통 이런 식으로 흐르기 쉽다.

```java
@Service
public class ScrapingJobService {

    private final AuthenticationService authenticationService;
    private final ScrapingEngineClient scrapingEngineClient;
    private final DocumentGenerateService documentGenerateService;
    private final FileStorageService fileStorageService;

    public void process(Long jobId) {
        var session = authenticationService.getSession(jobId);
        var result = scrapingEngineClient.scrape(session);
        var document = documentGenerateService.generate(result);
        fileStorageService.store(document);
    }
}
```

처음에는 별문제 없어 보인다.  
그런데 시간이 지나면 `ScrapingJobService`가 인증도 알고, 엔진 호출도 알고, PDF 생성도 알고, 파일 저장도 알고, 계속 뭔가를 더 많이 알게 된다.

이러면 스크래핑 모듈이 다른 모듈을 계속 끌어안게 된다.

Spring Modulith에서는 이런 흐름을 이벤트로 바꿔볼 수 있다.

```java
@Service
public class ScrapingJobService {

    private final ApplicationEventPublisher events;

    public void completeScraping(Long jobId, ScrapingResult result) {
        // 스크래핑 완료 처리
        events.publishEvent(new ScrapingCompletedEvent(jobId, result));
    }
}
```

그리고 문서 생성 쪽에서 필요한 이벤트를 듣는다.

```java
@Component
public class DocumentEventHandler {

    @ApplicationModuleListener
    void on(ScrapingCompletedEvent event) {
        // PDF/XLSX 생성 처리
    }
}
```

이렇게 하면 스크래핑 모듈은 "스크래핑이 완료됐다"는 사실만 발행하고, 그 이후에 무엇을 할지는 각 모듈이 가져갈 수 있다.

물론 모든 걸 이벤트로 바꾸겠다는 뜻은 아니다.  
강한 일관성이 필요한 흐름은 직접 호출이 더 나을 수도 있다. 다만 부가 기능이나 후처리는 이벤트로 분리하는 게 유지보수에는 더 좋아 보인다.

---

## polling과 Batch는 어떻게 할까

처음에는 Batch를 API 서버와 완전히 다른 애플리케이션으로 빼려고 했다.

이 생각은 아직도 유효하다.  
대량 처리, 정산, 통계, 외부 API 동기화처럼 API 요청과 성격이 완전히 다른 작업은 분리하는 게 맞다.

다만 지금은 순서를 조금 바꿔보려고 한다.

1. 먼저 API 서버 내부를 Spring Modulith 기준으로 정리한다.
2. polling scheduler는 작업을 깨우는 역할만 하게 만든다.
3. 스크래핑 실행, 문서 생성, 파일 저장은 각각의 모듈 책임으로 분리한다.
4. 실제 부하나 배포 요구가 명확해지면 Batch 애플리케이션으로 분리한다.

즉, 처음부터 Batch 프로젝트를 따로 만들기보다 `scraping`, `document`, `filestorage`, `scheduler` 같은 기능 모듈을 먼저 분리한다.  
그리고 그 안에서 스케줄 작업이 어디까지 커지는지 본다.

만약 Batch가 API 서버 리소스를 많이 잡아먹거나, 배포 주기가 달라지거나, 실패 재처리와 실행 이력 관리가 중요해지면 그때 Spring Batch 기반의 별도 애플리케이션으로 빼면 된다.

지금 중요한 건 "배치를 무조건 한 곳에 둔다"가 아니라, Batch 성격의 코드가 API 흐름에 섞이지 않게 만드는 것이다.

특히 스크래핑은 외부 기관, 인증, 세션, 파일 생성까지 엮여 있어서 실패 지점이 많다.  
그래서 처음부터 물리적으로 나누기보다, 먼저 실패 지점과 책임 경계를 코드 안에서 분명히 해두는 게 더 중요하다고 생각한다.

---

## 멀티모듈을 버린 건 아니다

멀티모듈을 아예 안 쓰겠다는 뜻은 아니다.

다만 지금 단계에서는 순서가 바뀐 것이다.

```text
1단계: Spring Modulith로 기능 경계 잡기
2단계: 모듈 간 의존성 검증하기
3단계: 이벤트로 느슨하게 연결할 부분 분리하기
4단계: 진짜 분리해야 하는 모듈이 보이면 멀티모듈 또는 별도 애플리케이션으로 분리하기
```

이렇게 가는 편이 레거시 개편에는 더 안전해 보인다.

처음부터 프로젝트를 크게 쪼개면 겉으로는 아키텍처가 좋아진 것처럼 보일 수 있다.  
하지만 실제로는 기존 꼬임을 여러 모듈에 나눠 담는 것에 그칠 수도 있다.

나는 이번에는 먼저 내부 경계를 찾고 싶다.  
그리고 그 경계가 어느 정도 검증되면, 그때 물리적인 분리를 고민하는 게 맞다고 생각한다.

---

## 지금 단계의 결론

이번 개편 방향을 다시 정리하면 이렇다.

1. 기존 Spring FE는 걷어내고 React로 프론트엔드를 분리한다.
2. 백엔드는 우선 하나의 Spring Boot 애플리케이션으로 단순하게 가져간다.
3. 내부 구조는 Spring Modulith로 수집 요청, 인증, 스크래핑, 문서 생성, 파일 저장 모듈을 나눈다.
4. 모듈 간 의존성은 테스트로 검증한다.
5. scheduler는 polling trigger 역할만 하도록 줄인다.
6. 후처리나 부가 기능은 이벤트 기반으로 분리한다.
7. Batch는 먼저 모듈로 격리하고, 필요성이 명확해지면 별도 애플리케이션으로 뺀다.
8. 멀티모듈은 당장 적용하지 않고, 나중에 물리적 분리가 필요해졌을 때 다시 검토한다.

결국 내가 하고 싶은 건 단순하다.

**한 번에 완벽한 구조를 만드는 게 아니라, 더 망가지기 어려운 구조로 바꾸는 것.**

레거시를 개편할 때 제일 위험한 건 너무 큰 그림부터 잡고 한 번에 다 바꾸려고 하는 거라고 생각한다.  
이번에는 Spring Modulith로 내부 경계를 먼저 세우고, 그 경계가 실제 코드에서 버티는지 확인하면서 다음 단계를 정하려고 한다.

---

## Reference

- [Spring Modulith Reference Documentation](https://docs.spring.io/spring-modulith/reference/)
- [Spring Modulith - Fundamentals](https://docs.spring.io/spring-modulith/reference/fundamentals.html)
- [Spring Modulith - Verifying Application Module Structure](https://docs.spring.io/spring-modulith/reference/verification.html)
- [Spring Modulith - Working with Application Events](https://docs.spring.io/spring-modulith/reference/events.html)

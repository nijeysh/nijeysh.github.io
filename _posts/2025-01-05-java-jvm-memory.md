---
layout: post
title: "Java 기초 - JVM과 메모리 구조"
date: 2025-01-05
tags: [java]
---

Java 프로그램이 실행되는 JVM(Java Virtual Machine)의 내부 구조를 살펴봅니다.

## JVM 메모리 영역

JVM은 크게 다음과 같은 메모리 영역으로 나뉩니다.

- **Method Area**: 클래스 정보, static 변수, 상수 풀이 저장되는 공간
- **Heap**: `new` 키워드로 생성된 객체와 배열이 저장되는 공간. GC의 대상
- **Stack**: 메서드 호출 시 스택 프레임이 쌓이는 공간. 지역 변수, 매개변수 저장
- **PC Register**: 현재 실행 중인 JVM 명령어 주소를 저장
- **Native Method Stack**: Java 외 언어로 작성된 네이티브 메서드를 위한 스택

## Heap 세부 구조

```
Young Generation
  ├── Eden Space
  ├── Survivor Space 0
  └── Survivor Space 1
Old Generation (Tenured)
Metaspace (Java 8+, PermGen 대체)
```

GC는 주로 Young Generation에서 발생하며(Minor GC), Old Generation이 가득 차면 Major GC(Full GC)가 발생합니다.

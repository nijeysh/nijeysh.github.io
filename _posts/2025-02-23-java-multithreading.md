---
layout: post
title: "Java 멀티스레딩 - synchronized와 volatile"
date: 2025-02-23
tags: [java]
---

멀티스레드 환경에서 공유 자원에 대한 접근을 제어하는 방법을 알아봅니다.

## synchronized

`synchronized` 키워드는 메서드나 블록에 락(lock)을 걸어 한 번에 하나의 스레드만 진입할 수 있도록 합니다.

```java
public class Counter {
    private int count = 0;

    // 메서드 동기화
    public synchronized void increment() {
        count++;
    }

    // 블록 동기화
    public void decrement() {
        synchronized(this) {
            count--;
        }
    }
}
```

## volatile

`volatile`은 변수를 CPU 캐시가 아닌 **메인 메모리에서 직접 읽고 쓰도록** 보장합니다. 단순 플래그 변수에 적합하며, 복합 연산(++, --)에는 보장이 부족합니다.

```java
private volatile boolean running = true;

public void stop() {
    running = false;  // 모든 스레드에 즉시 반영
}
```

## 정리

| | synchronized | volatile |
|--|--|--|
| 원자성 | O | X (단순 읽기/쓰기만) |
| 가시성 | O | O |
| 성능 | 상대적으로 느림 | 빠름 |

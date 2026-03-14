---
layout: post
title: "Vercel로 프론트엔드 프로젝트 배포하기 (CLI & GitHub 연동)"
date: 2026-03-14
category: web
tags: [vercel, deploy, cli, github]
---

Vercel을 사용하여 프론트엔드 프로젝트를 배포하는 방법은 크게 두 가지로 나눌 수 있다.

1. **GitHub 레포지토리와 연동하여 Push할 때마다 자동 배포하기 (CI/CD)**
2. **GitHub 연동 없이 터미널에서 Vercel CLI로 직접 배포하기**

---

## 1. GitHub 레포지토리와 연동해서 배포하기 (CI/CD)

> 🚧 이 섹션은 추후 작성될 예정

(내용 추가 예정)

---

## 2. GitHub 연동 없이 터미널 배포하기 (Vercel CLI)

github repository와 연동하지 않고 로컬에서 바로 배포하는 방법으로 진행해본다.

### 2-1. Vercel CLI 설치하기

가장 먼저 로컬 환경에 Vercel CLI를 전역(global)으로 설치해야 한다. Node.js가 설치되어 있어야 하며, 터미널을 열고 아래 명령어를 입력한다.

```bash
npm i -g vercel
```

설치가 완료되었다면 버전을 확인하여 정상적으로 설치되었는지 체크해 볼 수 있다.

```bash
vercel --version
```

### 2-2. Vercel 로그인 및 프로젝트 배포

명령어를 사용하기 위해 Vercel 계정에 로그인해야 한다.

```bash
vercel
```

명령어를 실행하면 배포 관련 메뉴가 나온다.

- **Set up and deploy "~"? [Y/n]**: `Y` (현재 폴더 배포)
- **Which scope do you want to deploy to?**: 배포할 계정 선택
- **Link to existing project? [y/N]**: `N` (새 프로젝트)
- **What's your project's name?**: 프로젝트 이름 설정
- **In which directory is your code located? ./**: `Enter` (현재 폴더가 루트인 경우)
- **Want to modify these settings? [y/N]**: `N` (기본 빌드 설정 사용)

모든 질문에 답하면 빌드 및 배포가 시작되며 완료 시 미리보기 URL이 제공된다.
실제 프로덕션 환경에 배포하기 위한 안내가 나온다.
```
Deployed to production. Run `vercel --prod` to overwrite later
```

해당 명령어를 실행하면 최종적으로 **Production URL**(`https://프로젝트명.vercel.app` 형태)을 발급해준다.

### 2-3. 기존 프로젝트 연결

재배포를 하려면 기존 프로젝트를 연결하면 된다.

```
vercel link
```

---

## 마무리

아주 간단하게 무료로 React 프로젝트를 배포할 수 있었다. 
사이드 프로젝트를 빠르게 배포하고 싶거나 간단한 사이트를 만들고 싶을 때 유용할 것 같다.
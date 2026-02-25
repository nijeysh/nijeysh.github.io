---
layout: post
title: "RSA 암호화를 활용한 외부 API 통신 보안 (Spring/Java)"
date: 2025-02-25
tags: [java, spring, security]
---

외부 기관과 API 통신을 하게 되면서 데이터 보안을 위해 RSA 암호화를 도입하게 되었습니다. 이 글에서는 RSA가 무엇인지, 왜 필요한지, 그리고 Spring/Java에서 어떻게 구현하는지 정리합니다.

---

## 왜 RSA를 사용했는가?

외부 기관과 API를 연동하는 프로젝트에서 **민감한 데이터를 안전하게 주고받아야 하는 요구사항**이 생겼습니다.

- 외부 기관에서 **공개키(Public Key)/개인키(Private Key) 쌍을 발급**받아 통신에 사용
- 요청 데이터를 상대방의 공개키로 암호화하여 전송하면, 상대방만 자신의 개인키로 복호화 가능
- 대칭키 방식과 달리 **키 교환 과정 자체가 안전**하여 외부 기관 간 통신에 적합

> 요약: 대칭키는 같은 키를 공유해야 해서 키 유출 위험이 있지만, RSA는 공개키만 공유하면 되므로 외부 기관과의 통신에 안전합니다.

---

## RSA란?

**RSA(Rivest–Shamir–Adleman)**는 대표적인 **비대칭키(공개키) 암호화 알고리즘**입니다.

### 핵심 개념

| 구분 | 설명 |
|------|------|
| **공개키 (Public Key)** | 누구에게나 공개 가능. 데이터를 **암호화**할 때 사용 |
| **개인키 (Private Key)** | 소유자만 보관. 데이터를 **복호화**할 때 사용 |
| **키 길이** | 일반적으로 2048비트 이상 권장 |

### 동작 흐름

```
1. 수신자가 공개키/개인키 쌍을 생성
2. 수신자가 공개키를 송신자에게 전달
3. 송신자가 공개키로 데이터를 암호화하여 전송
4. 수신자가 개인키로 데이터를 복호화
```

### 대칭키 vs 비대칭키(RSA) 비교

| 항목 | 대칭키 (AES 등) | 비대칭키 (RSA) |
|------|----------------|---------------|
| 키 개수 | 1개 (동일한 키로 암·복호화) | 2개 (공개키 + 개인키) |
| 키 교환 | 안전한 채널 필요 | 공개키만 전달하면 됨 |
| 속도 | 빠름 | 상대적으로 느림 |
| 용도 | 대량 데이터 암호화 | 키 교환, 전자서명, 소량 데이터 암호화 |

> 실무에서는 RSA로 대칭키를 안전하게 교환한 뒤, 실제 데이터는 대칭키(AES)로 암호화하는 **하이브리드 방식**을 많이 사용합니다.

---

## Spring/Java 구현 예시

### 1. RSA 키 쌍 생성

```java
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.Base64;

public class RsaKeyGenerator {

    public static KeyPair generateKeyPair() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048); // 2048비트 권장
        return generator.generateKeyPair();
    }

    public static String toBase64(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }

    public static void main(String[] args) throws Exception {
        KeyPair keyPair = generateKeyPair();

        System.out.println("공개키: " + toBase64(keyPair.getPublic().getEncoded()));
        System.out.println("개인키: " + toBase64(keyPair.getPrivate().getEncoded()));
    }
}
```

### 2. 암호화 / 복호화 유틸리티

```java
import javax.crypto.Cipher;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.Base64;

public class RsaCryptoUtil {

    /**
     * 공개키로 암호화
     */
    public static String encrypt(String plainText, PublicKey publicKey) throws Exception {
        Cipher cipher = Cipher.getInstance("RSA");
        cipher.init(Cipher.ENCRYPT_MODE, publicKey);
        byte[] encrypted = cipher.doFinal(plainText.getBytes("UTF-8"));
        return Base64.getEncoder().encodeToString(encrypted);
    }

    /**
     * 개인키로 복호화
     */
    public static String decrypt(String encryptedText, PrivateKey privateKey) throws Exception {
        Cipher cipher = Cipher.getInstance("RSA");
        cipher.init(Cipher.DECRYPT_MODE, privateKey);
        byte[] decoded = Base64.getDecoder().decode(encryptedText);
        byte[] decrypted = cipher.doFinal(decoded);
        return new String(decrypted, "UTF-8");
    }
}
```

### 3. Base64 문자열에서 키 복원

외부 기관으로부터 Base64 인코딩된 공개키를 받는 경우가 많습니다.

```java
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.PrivateKey;
import java.security.spec.X509EncodedKeySpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

public class RsaKeyUtil {

    /**
     * Base64 문자열 → PublicKey 객체
     */
    public static PublicKey getPublicKey(String base64PublicKey) throws Exception {
        byte[] keyBytes = Base64.getDecoder().decode(base64PublicKey);
        X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
        KeyFactory factory = KeyFactory.getInstance("RSA");
        return factory.generatePublic(spec);
    }

    /**
     * Base64 문자열 → PrivateKey 객체
     */
    public static PrivateKey getPrivateKey(String base64PrivateKey) throws Exception {
        byte[] keyBytes = Base64.getDecoder().decode(base64PrivateKey);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
        KeyFactory factory = KeyFactory.getInstance("RSA");
        return factory.generatePrivate(spec);
    }
}
```

### 4. Spring 서비스에서 활용

```java
import org.springframework.stereotype.Service;
import java.security.KeyPair;
import java.security.PublicKey;

@Service
public class RsaService {

    private final KeyPair keyPair;

    public RsaService() throws Exception {
        // 실무에서는 키를 파일이나 설정에서 로드합니다
        this.keyPair = RsaKeyGenerator.generateKeyPair();
    }

    /**
     * 외부 기관에 보낼 데이터를 암호화
     */
    public String encryptForPartner(String data, String partnerPublicKeyBase64) throws Exception {
        PublicKey partnerKey = RsaKeyUtil.getPublicKey(partnerPublicKeyBase64);
        return RsaCryptoUtil.encrypt(data, partnerKey);
    }

    /**
     * 외부 기관에서 받은 암호화 데이터를 복호화
     */
    public String decryptFromPartner(String encryptedData) throws Exception {
        return RsaCryptoUtil.decrypt(encryptedData, keyPair.getPrivate());
    }

    /**
     * 우리의 공개키를 Base64로 제공 (외부 기관에 전달)
     */
    public String getPublicKeyBase64() {
        return RsaKeyGenerator.toBase64(keyPair.getPublic().getEncoded());
    }
}
```

### 5. 테스트 코드

```java
import java.security.KeyPair;

public class RsaTest {

    public static void main(String[] args) throws Exception {
        // 키 쌍 생성
        KeyPair keyPair = RsaKeyGenerator.generateKeyPair();

        String originalText = "Hello, 외부 기관! 민감한 데이터입니다.";

        // 공개키로 암호화
        String encrypted = RsaCryptoUtil.encrypt(originalText, keyPair.getPublic());
        System.out.println("암호화: " + encrypted);

        // 개인키로 복호화
        String decrypted = RsaCryptoUtil.decrypt(encrypted, keyPair.getPrivate());
        System.out.println("복호화: " + decrypted);

        // 원본과 일치하는지 확인
        System.out.println("일치 여부: " + originalText.equals(decrypted));
    }
}
```

---

## 실무 적용 시 주의사항

1. **키 관리**: 개인키는 절대 외부에 노출되지 않도록 안전하게 보관합니다 (Vault, HSM 등 활용)
2. **데이터 크기 제한**: RSA는 키 길이에 따라 암호화 가능한 데이터 크기가 제한됩니다 (2048비트 키 → 최대 245바이트). 큰 데이터는 AES + RSA 하이브리드 방식을 사용합니다
3. **패딩 방식**: 실무에서는 `RSA/ECB/OAEPWithSHA-256AndMGF1Padding` 같은 안전한 패딩을 권장합니다
4. **키 로테이션**: 주기적으로 키를 갱신하여 보안을 강화합니다

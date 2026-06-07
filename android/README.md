# Android app

Este diretorio contem o projeto Android do SemVencer junto do projeto web.

Fluxo principal:

```bash
npm run build:android
```

Esse comando gera o build web do Vite direto em:

```text
android/app/src/main/assets/semvencer
```

Para gerar um APK debug a partir deste repositorio:

```bash
npm run android:debug
```

O APK fica em:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Nao edite um APK pronto. Edite o projeto web e/ou os arquivos Android aqui dentro, depois gere um APK novo.

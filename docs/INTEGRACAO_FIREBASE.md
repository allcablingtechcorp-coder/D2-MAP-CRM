# Integração Firebase — fundação segura

## Estado verificado em 19 de setembro de 2026

A aplicação V2 pública permanece no modo demonstrativo. A conta ativa na Firebase CLI é `dantefrota@gmail.com`; essa conta não lista o projeto `d2-map-crm` e recebe HTTP 403 ao consultar aplicativos e bancos Firestore desse projeto. Não houve leitura, gravação ou alteração de configuração no ambiente Firebase de produção.

O código cliente necessário para a próxima fase foi preparado em `v2/src/infrastructure/firebase/`. A ativação exige acesso administrativo ao projeto, confirmação da região do Firestore e implantação do backend confiável descrito neste documento.

## Componentes implementados

| Componente | Responsabilidade |
|---|---|
| `config.ts` | Selecionar `demo` ou `firebase` e rejeitar configuração incompleta |
| `adapters.ts` | Autenticar com Google, observar a sessão, ler associações e chamar o comando administrativo seguro |
| `membershipDocument.ts` | Validar documentos externos antes de transformá-los em associações do domínio |
| `.env.example` | Documentar as variáveis necessárias sem armazenar credenciais reais |

O SDK modular Firebase `12.19.0` foi fixado no `package.json`. A documentação oficial recomenda o SDK modular com empacotador para permitir remoção de código não utilizado. O build separa os adaptadores em um arquivo carregado sob demanda; no modo demonstrativo, o navegador não solicita nem executa esse arquivo.

## Configuração de execução

O modo padrão é:

```text
VITE_CRM_BACKEND=demo
```

Para uma homologação Firebase configurada:

```text
VITE_CRM_BACKEND=firebase
VITE_FIREBASE_API_KEY=<configuração pública do aplicativo web>
VITE_FIREBASE_AUTH_DOMAIN=<domínio do Firebase Authentication>
VITE_FIREBASE_PROJECT_ID=<projeto confirmado>
VITE_FIREBASE_APP_ID=<aplicativo web confirmado>
VITE_FIREBASE_STORAGE_BUCKET=<opcional>
VITE_FIREBASE_MESSAGING_SENDER_ID=<opcional>
VITE_FIREBASE_FUNCTIONS_REGION=<região confirmada>
VITE_CRM_ORGANIZATION_ID=d2-group
```

Os valores de configuração do aplicativo web identificam os recursos Firebase, mas a proteção dos dados depende das regras do Firestore, da autenticação, do App Check quando aplicável e da autorização repetida no backend. Segredos administrativos e chaves de conta de serviço nunca devem usar variáveis `VITE_*`, pois essas variáveis são incorporadas ao JavaScript entregue ao navegador.

## Fluxo de autenticação

1. O navegador define persistência local da sessão.
2. O usuário entra com o provedor Google.
3. A identidade é normalizada para `uid`, e-mail, nome e foto.
4. O CRM consulta `organizations/{organizationId}/memberships/{uid}`.
5. `resolveSession` libera o workspace apenas quando a associação existe e está ativa.
6. Módulos, permissões e escopo são calculados a partir da associação validada.
7. A navegação exibe somente os módulos atribuídos, e o shell identifica o usuário e seu papel real.

Antes da homologação, o Firebase Authentication deve habilitar Google como provedor e incluir `allcablingtechcorp-coder.github.io` entre os domínios autorizados.

## Contrato de associações

Leituras usam:

```text
organizations/{organizationId}/memberships/{uid}
```

O identificador `uid` vem do caminho do documento. O conteúdo aceito é validado contra os papéis, estados, escopos, módulos e permissões conhecidos pelo domínio. Valores desconhecidos ou tipos inválidos interrompem a leitura; o cliente não converte dados externos por coerção.

Alterações administrativas não gravam diretamente no Firestore. `MembershipRepository.save` chama a função autenticada `saveMembership`, com o contrato:

```text
request.auth.uid
organizationId
uid do usuário alvo
membership sem o uid duplicado
```

A Cloud Function ainda precisa ser criada e deve executar, no servidor, as seguintes operações em uma única transação:

1. exigir identidade autenticada;
2. carregar a associação do ator;
3. exigir `membership.manage` e papel proprietário;
4. rejeitar qualquer mudança no proprietário protegido `allcablingtechcorp@gmail.com`;
5. impedir a remoção do último proprietário ativo;
6. validar todos os campos do novo documento;
7. gravar a associação;
8. gravar o evento de auditoria com ator, alvo, motivo e diferenças antes/depois.

## Regras mínimas para homologação

As regras ainda não foram geradas porque a edição, a região e o estado real do banco não puderam ser verificados. Quando o acesso for liberado, a política deve ser implementada e testada no Emulator Suite com estes princípios:

- negação por padrão;
- leitura da própria associação por usuário autenticado;
- leitura de outras associações somente com permissão administrativa;
- nenhuma gravação cliente em associações e eventos de auditoria;
- acesso comercial limitado pela organização e pelo escopo efetivo;
- testes negativos para usuário sem associação, suspenso, revogado, organização diferente e tentativa de escalada de papel.

## Critérios de ativação

1. `d2-map-crm` aparece na lista da Firebase CLI com a conta autorizada.
2. Aplicativo web, projeto, região e edição do Firestore são confirmados.
3. Provedor Google e domínio do GitHub Pages são confirmados.
4. `saveMembership` e gravação confiável de auditoria são implantados.
5. Regras e índices passam nos testes do Emulator Suite.
6. A associação protegida do proprietário é criada e validada.
7. Login, bloqueio, módulos, escopos e logout passam em homologação.
8. Somente então `VITE_CRM_BACKEND=firebase` é usado no build publicado.

## Referências oficiais

- https://firebase.google.com/docs/web/setup
- https://firebase.google.com/docs/auth/web/auth-state-persistence
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/docs/emulator-suite/connect_firestore

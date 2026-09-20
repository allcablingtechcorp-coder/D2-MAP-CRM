# Integração Firebase — fundação segura

## Estado verificado em 19 de setembro de 2026

A aplicação V2 pública permanece no modo demonstrativo. A conta proprietária `allcablingtechcorp@gmail.com` foi conectada à Firebase CLI e o acesso administrativo ao projeto `d2-map-crm` foi confirmado em modo de leitura.

O ambiente existente possui:

- Cloud Firestore Native, banco `(default)`, edição Standard e região multirregional `nam5`;
- camada gratuita ativa;
- aplicativo Web `D2 CRM MAP`;
- Firebase Authentication com Google habilitado;
- `allcablingtechcorp-coder.github.io` entre os domínios autorizados;
- quatro identidades cadastradas no Authentication;
- coleções legadas `users` e `visitas` no Firestore;
- plano Spark.

Nenhuma coleção, documento, regra, índice, provedor ou configuração de produção foi alterado nesta etapa.

## Componentes implementados

| Componente | Responsabilidade |
|---|---|
| `config.ts` | Selecionar `demo` ou `firebase` e rejeitar configuração incompleta |
| `adapters.ts` | Autenticar com Google, observar a sessão, ler associações e chamar o comando administrativo seguro |
| `membershipDocument.ts` | Validar documentos externos antes de transformá-los em associações do domínio |
| `.env.example` | Documentar as variáveis necessárias sem armazenar credenciais reais |
| `functions/src/index.ts` | Executar a alteração administrativa autenticada em uma transação |
| `functions/src/membershipPolicy.ts` | Validar o comando, documentos, proprietário protegido e diferenças auditáveis |
| `firestore.rules` | Negar por padrão, permitir leituras autorizadas e bloquear toda gravação direta de governança |
| `rules-tests/` | Validar regras positivas e negativas contra o Firestore Emulator |
| `firebase.json` | Fixar região, regras, índices, Functions e portas do Emulator Suite |

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
targetUid
patch: role, status, scope e modules
reason
```

A Cloud Function implementada executa, no servidor, as seguintes operações em uma única transação:

1. exigir identidade autenticada;
2. carregar a associação do ator;
3. exigir `membership.manage` e papel proprietário;
4. rejeitar qualquer mudança no proprietário protegido `allcablingtechcorp@gmail.com`;
5. impedir a remoção do último proprietário ativo;
6. impedir atribuição comum do papel proprietário;
7. validar o comando e os documentos existentes;
8. preservar e-mail, nome, proteção e substituições de permissão existentes;
9. gravar somente os campos administrativos permitidos;
10. gravar o evento de auditoria com ator, alvo, motivo e diferenças antes/depois.

## Regras preparadas para homologação

A política local implementa estes princípios:

- negação por padrão;
- leitura da própria associação por usuário autenticado;
- leitura de outras associações somente com permissão administrativa;
- nenhuma gravação cliente em associações e eventos de auditoria;
- caminhos desconhecidos e coleções legadas negados pela nova política até que seus contratos sejam migrados explicitamente.

Os testes no Emulator Suite cobrem usuário anônimo, leitura da própria associação, usuário suspenso, proprietário, administrador operacional, vendedor, gravações diretas, convites, auditoria e caminhos desconhecidos. Resultado local: 7 testes aprovados.

As regras atuais de produção não foram substituídas. O console mostra uma versão publicada em 31 de julho de 2026 baseada no modelo temporário de desenvolvimento, cujo próprio texto informa expiração após 30 dias. A substituição deve ocorrer junto da ativação do novo backend para evitar uma migração parcial.

## Bloqueio para implantação das Functions

O projeto está no plano Spark. Cloud Functions for Firebase exige o plano Blaze para implantação em produção. A Function pode ser compilada e emulada localmente, mas não pode ser publicada enquanto uma conta de faturamento não estiver vinculada ao projeto.

A mudança para Blaze é uma decisão de faturamento e não foi executada automaticamente. Depois da ativação, devem ser configurados alertas de orçamento e limites de escala antes da primeira implantação.

## Critérios de ativação

1. [Concluído] `d2-map-crm` aparece na lista da Firebase CLI com a conta proprietária.
2. [Concluído] Aplicativo Web, projeto, região e edição do Firestore foram confirmados.
3. [Concluído] Provedor Google e domínio do GitHub Pages foram confirmados.
4. [Concluído localmente] `saveMembership`, auditoria transacional, regras e índices foram implementados.
5. [Concluído localmente] Regras e políticas passaram nos testes automatizados.
6. [Pendente] Migrar o projeto para Blaze com orçamento controlado.
7. [Pendente] Implantar Function, regras e índices.
8. [Pendente] Criar e validar a associação protegida do proprietário.
9. [Pendente] Testar login, bloqueio, módulos, escopos, alteração administrativa e logout em homologação.
10. [Pendente] Ativar `VITE_CRM_BACKEND=firebase` no build público.

## Referências oficiais

- https://firebase.google.com/docs/web/setup
- https://firebase.google.com/docs/auth/web/auth-state-persistence
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/docs/emulator-suite/connect_firestore
- https://firebase.google.com/docs/functions/callable
- https://firebase.google.com/docs/functions/get-started

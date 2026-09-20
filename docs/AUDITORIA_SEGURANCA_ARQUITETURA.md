# Auditoria de segurança e arquitetura — D2 CRM

Data: 20 de setembro de 2026. Base examinada: commit `694eced`, com correções na branch `codex/security-audit-hardening`.

## Parecer

**Liberado para homologação controlada; não aprovado para operação comercial multiusuário.**

A autenticação Google e a governança Firebase existem e funcionam. O domínio comercial continua demonstrativo, com armazenamento no navegador. Não há contratos de persistência comercial, autorização por registro/equipe, convites reais nem registro de login no servidor. Portanto, o estado anterior descrito como “ativação concluída” corresponde à ativação de autenticação e governança, e não à conclusão do CRM.

Esta auditoria examinou código, testes, workflow e configurações visíveis no console. Não é um teste de invasão nem prova de ausência de vulnerabilidades. Contas reais de vendedores e gestores não foram alteradas para simular ataques.

## Correções desta entrega

| ID | Problema comprovado | Correção |
|---|---|---|
| A01 | A associação era lida uma vez no login; suspensão posterior não atualizava o workspace aberto | Assinatura Firestore em tempo real; alteração, exclusão e falha de leitura retiram o acesso. Uma associação ativa apenas em cache não autoriza a sessão |
| A02 | A conta autenticada não tinha ação de logout | Botão de saída localizado em PT/EN/ES; feedback em caso de falha |
| A03 | Todas as contas usavam a mesma chave de armazenamento comercial local | Chave separada por organização e UID, remontagem do workspace na troca de conta e aviso visível de dados locais de teste |
| A04 | O servidor ignorava negações explícitas e módulos administrativos em parte da governança | Regras exigem papel administrativo ativo, módulo admin e permissão de leitura não negada; callable exige proprietário ativo, módulo admin e ausência de negação de membership.manage |
| A05 | Módulo atribuído podia mostrar administração a papel sem competência administrativa | Navegação administrativa exige papel e permissões; controles de edição usam a política efetiva, incluindo proteção por e-mail |
| A06 | Ações comerciais e exportação não verificavam as permissões do papel | Bloqueios nos comandos locais e controles para cadastro, atividades, oportunidades, avanço e exportação |
| A07 | Configuração ausente no workflow podia publicar a demonstração | Produção exige modo Firebase e variáveis obrigatórias antes do build; falha de configuração interrompe publicação |
| A08 | Falha de armazenamento local não era exibida | Mensagem explícita quando a gravação no navegador falha |
| A09 | Resposta antiga da busca podia substituir resultado recente; marcadores antigos permaneciam após erro | Identificador de busca, invalidação na desmontagem, limpeza de marcadores e seleção antes da nova consulta |
| A10 | Maps era carregado sem o protocolo assíncrono recomendado e sem timeout | loading=async, callback, timeout e recuperação após falha de carregamento |
| A11 | Relatório usava nome fixo de emissor | Exportação identifica o usuário autenticado |

A separação das chaves locais evita mistura acidental na interface. **Não é uma fronteira de segurança:** scripts da mesma origem e pessoas com acesso ao perfil do navegador podem ler o armazenamento. Usar apenas dados de teste até a migração comercial.

A chave antiga `d2-crm-demo-workspace-v1` permanece preservada. Não é copiada para usuários autenticados porque os registros antigos não possuem identidade verificável do criador. A migração deverá oferecer inventário, prévia, seleção explícita e deduplicação; nunca atribuir silenciosamente o conteúdo a quem entrar primeiro.

## Evidências de teste

- Frontend: 13 arquivos, 49 testes aprovados, incluindo callbacks atrasados após logout, suspensão durante sessão, erros de leitura, isolamento de contas e ações de perfil somente leitura.
- Functions: 7 testes de política aprovados e TypeScript compilado.
- Firestore Emulator: 10 testes aprovados, incluindo organização diferente, módulo administrativo removido, negações de permissões, suspensão e proibição de gravações diretas.
- Frontend de produção: build aprovado com 2.122 módulos; aviso de tamanho no chunk Firebase permanece.
- Dependências frontend: npm audit --omit=dev sem vulnerabilidades reportadas nesta execução.
- Dependências Functions: 8 entradas moderadas na árvore de dependências, decorrentes do advisory GHSA-w5hq-g745-h8pq de uuid; não representam oito explorações independentes.
- A política de proteção do proprietário por UID de associação, papel e e-mail foi preservada.

Os testes das Functions atuais exercitam a política pura. A transação completa de saveMembership ainda precisa de teste integrado com concorrência, gravação atômica e auditoria. Não confundir aprovação desses testes com homologação completa de todos os papéis em produção.

## Configurações externas examinadas

- Firebase App Check: console mostra “Get started”; integração ausente no cliente e enforceAppCheck ausente na callable. Ainda não configurado.
- Chave de navegador criada pelo Firebase: restrição por 25 APIs e “Application restrictions: None” no console. Reduzir APIs e testar restrição de origem sem interromper Firebase Auth. Chave Firebase pública não substitui autorização.
- Chaves Maps e Firebase: a comparação das variáveis do GitHub confirmou valores diferentes, sem exibi-los. Restrições, quotas e projeto da chave específica do Maps **não foram verificados nesta auditoria**.
- Orçamento de US$ 10 documentado na ativação anterior: não foi verificado teto de cobrança nem desligamento automático. Alertas de orçamento, por si só, não interrompem serviços.
- IAM completo, recuperação de backup, retenção de logs e proteção de branch exigem uma verificação específica antes da liberação comercial.

## Pendências que impedem a conclusão comercial

### P1 — Persistência real e autorização por registro

Implementar repositórios de empresas, contatos, leads, oportunidades e atividades em `organizations/{organizationId}/...`. Identificadores obrigatórios: organizationId, ownerUid, createdByUid e, quando aplicável, teamId; nomes servem apenas para exibição. Datas de criação e auditoria devem vir do servidor.

Toda consulta e mutação deve aplicar status ativo, módulo, permissão e escopo. assigned_records precisa validar responsável; assigned_teams precisa validar associação à equipe. custom não deve ser oferecido sem um contrato implementado. Dashboard e PDF devem usar a mesma seleção autorizada de registros.

Critérios de aceite: vendedor A não lê, altera ou exporta registros do vendedor B por UI, SDK ou chamada direta; outra organização é negada; usuário suspenso perde o acesso; duas gravações simultâneas não perdem dados; falha de rede não apresenta sucesso.

### P1 — Convites, provisionamento e trilha de uso

O convite atual existe apenas no modo demo. Implementar convite persistente, vínculo com e-mail Google verificado, expiração, aceite único e proteção contra autoatribuição do papel proprietário. Credenciais são autenticadas pelo Google; não criar banco próprio de senhas.

A única callable atual é saveMembership. Não há registro real de login/negação de acesso; a auditoria vazia observada antes da correção não comprova rastreamento de utilização. Criar eventos no servidor, com ator derivado do token, timestamp do servidor e idempotência. Nunca aceitar actorUid, papel ou identidade administrativa enviados livremente pelo cliente. Implementar histórico de alterações e exportações e testes da transação completa.

O painel ainda apresenta módulos como etiquetas sem editor. Adicionar seleção de módulos, revisão de concessões/revogações e cobertura dos casos de administrador sem permissão de edição.

### P1 — Migração, backup e recuperação

Inventariar coleções legadas users/visitas e registros locais sem sobrescrever ou importar automaticamente. Elaborar mapeamento e prévia de conflitos, guardar uma cópia recuperável e ensaiar reversão. Configurar retenção e realizar um teste de restauração. Regras atuais continuam negando as coleções legadas.

### P2 — App Check e restrições de chave

Registrar aplicação web com reCAPTCHA Enterprise, integrar cliente, observar métricas de tokens válidos e então ativar enforcement no Firestore/callable. Validar antes que produção recebe tokens válidos; ligar enforcement isoladamente bloqueia o cliente atual.

Confirmar projeto da chave Maps, restrições por site/API e quotas. Manter chaves administrativas fora do cliente. Revisar IAM das contas de serviço para privilégio mínimo.

### P2 — Google Maps, precisão e custos

Preservar o mapa Google real durante a migração para Place e AdvancedMarkerElement. Verificar Places API (New), map ID, APIs permitidas, atribuição, campos solicitados, quotas e custo por busca antes da troca. As APIs legadas funcionais não foram removidas nesta entrega.

O score atual deriva de nota e quantidade de avaliações; é heurístico e não comprova adequação comercial ou qualificação de lead. A busca textual e radius são direcionamento geográfico, não filtro comprovadamente rígido de distância. A próxima implementação deve explicar o score, aplicar distância quando necessária, preservar placeId e evitar persistência de conteúdo Google além do que as políticas permitirem.

### P2 — Métricas e interface ainda demonstrativas

Há conversão fixa de 28%, largura visual de barras não proporcional aos valores, contagens sintéticas de contatos e controles sem ação (busca global, notificações e alguns filtros). Substituir por métricas calculadas sobre dados autorizados, apresentar estados vazios reais e implementar ou remover controles sem função. Evitar qualquer promessa de “relatório real” enquanto os dados forem locais.

### P2 — Dependências e automação

Reavaliar a atualização suportada dos SDKs e da árvore gaxios/uuid. Não forçar mudança de versão principal via override sem testes. Adicionar testes de integração das callables, teste de UI para os papéis e política de revisão de branch. Configuração incompleta do frontend já é rejeitada pelo workflow.

## Sequência executável recomendada

1. **SOL HIGH — persistência comercial e escopos:** implementar schema, repositórios, comandos servidor, índices e testes negativos; iniciar com dados vazios, sem importar demonstrações.
2. **SOL HIGH — usuários e auditoria:** convites reais, aceite, editor de módulos, eventos de login/uso e testes transacionais.
3. **SOL HIGH — preparação operacional:** App Check gradual, restrições/quotas, atualização Maps, migração assistida, backups e correção das métricas demonstrativas.
4. **Astra HIGH — revisão da versão candidata:** verificar os contratos e testes dos três blocos; autorizar liberação comercial somente com evidência de isolamento, persistência e recuperação.

Essa divisão é uma recomendação de execução pelo tipo de trabalho; não é estimativa de créditos nem garantia de ausência de erros. Não há necessidade demonstrada de manter o nível máximo durante toda a implementação.

## Referências oficiais consultadas

- Atualizações em tempo real e tratamento de erro: https://firebase.google.com/docs/firestore/query-data/listen
- App Check web: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
- Enforcement em callables: https://firebase.google.com/docs/app-check/cloud-functions
- Carregamento do Maps: https://developers.google.com/maps/documentation/javascript/load-maps-js-api
- Restrições de chaves Maps: https://developers.google.com/maps/api-security-best-practices
- Atribuição e armazenamento de resultados: https://developers.google.com/maps/documentation/javascript/policies
- Advisory de dependência: https://github.com/advisories/GHSA-w5hq-g745-h8pq
- Alertas e tetos de orçamento: https://firebase.google.com/docs/projects/billing/avoid-surprise-bills
- Modelo Sol e níveis de raciocínio: https://developers.openai.com/api/docs/models/gpt-5.6-sol

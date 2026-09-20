# Auditoria da versão candidata — 20/09/2026

## Parecer e alcance

Base: `main` em `c5f1689`. Correções na branch `codex/final-audit`.

**A versão anterior não estava integralmente finalizada.** Esta auditoria encontrou e reproduziu falhas em transações de permissões, validação de convites, registros de acesso, separação de módulos e apresentação de métricas. As correções abaixo tornam a versão candidata adequada à homologação controlada dos fluxos disponíveis. Não equivalem à aprovação de todo o escopo de um CRM completo para operação definitiva.

Este documento substitui os pareceres anteriores para os pontos reexaminados. A auditoria compreende revisão de código, testes de política, transações reais no emulador Firestore, build, dependências e inspeção de interface. Não constitui teste de invasão nem comprovação de ausência de defeitos. Os testes transacionais chamam os handlers callable com identidades simuladas; não substituem um ensaio com várias contas Google reais em produção.

## Defeitos reproduzidos e corrigidos

| ID | Defeito | Correção e evidência |
|---|---|---|
| F01 | Alterar uma associação antiga sem `teamIds` falhava: a auditoria tentava gravar `undefined` no Firestore | Ausência normalizada para lista vazia. Teste de `saveMembership` confirma associação e auditoria na mesma transação |
| F02 | Aceite de convite verificava apenas a existência do texto do e-mail | Exige e-mail verificado e provedor Google no token autenticado; outro e-mail não recebe acesso |
| F03 | Associação revogada retornava `accepted: true` | Aceite idempotente somente para associação ativa com o mesmo e-mail; revogação preservada |
| F04 | Convite vencido ainda aparecia pendente e bloqueava novo convite | Expiração calculada na listagem; renovação permitida; trava transacional por e-mail evita dois convites simultâneos; histórico anterior preservado |
| F05 | O navegador podia declarar login bem-sucedido sem associação | Servidor deriva o resultado da associação, rejeita organização inexistente e mantém idempotência por autenticação/resultado |
| F06 | Contatos eram retornados a perfis com apenas Dashboard | Empresas e contatos exigem módulo Empresas, além de papel/permissão e escopo. Criação de contato também exige o módulo |
| F07 | Repetir conclusão de atividade gerava novo evento e mudava a conclusão | Operação idempotente retorna o registro já concluído, sem duplicar auditoria |
| F08 | Permissões eram lidas antes da transação comercial | Gravações comerciais e criação de equipe releem a associação dentro da transação; mudança de acesso aborta a operação |
| F09 | Relatórios usavam conversão fixa de 28%, ciclo fixo de 21 dias, período fixo, vendedores fixos e gráfico de origem fixo | Conversão = ganhos/(ganhos+perdidos); sem encerrados, exibe traço. Pipeline soma apenas etapas abertas. Gráficos refletem origens e responsáveis existentes. Período identificado como todos os registros autorizados |
| F10 | PDF somava negócios encerrados no pipeline e desenhava barras positivas com zero | PDF e tela usam o mesmo cálculo de pipeline aberto; barra zero não recebe preenchimento; teste confere valores e imagem institucional |
| F11 | Mais de 500 registros podiam produzir relatórios silenciosamente incompletos | A consulta busca um registro adicional e rejeita excesso com erro explícito; a interface bloqueia métricas/exportação após falha de carga e permite tentar novamente |
| F12 | Troca de permissões podia deixar o snapshot comercial anterior na tela | Workspace remontado quando a associação muda; dados autorizados são recarregados |
| F13 | Oportunidades perdidas não tinham ação na interface e encerradas desapareciam sem consulta | Ação de marcar perda e lista de negócios encerrados; indicadores recalculados; cabeçalho do pipeline exclui encerrados |
| F14 | Botão de exportação de leads não executava ação | CSV dos leads filtrados, condicionado à permissão de exportação, com proteção contra fórmulas de planilha |
| F15 | Telefones e e-mails dos contatos cadastrados não eram apresentados | Contatos exibem dados e links de telefone/e-mail; empresas apresentam website/telefone |
| F16 | Mapa apresentava uma pontuação de potencial comercial sem validação de qualificação | Exibe a avaliação original do Google, em escala de 5, ou ausência de avaliação. Prioridade comercial não é inferida dessa nota |
| F17 | Controles de busca global, notificação, ajuda e menus não tinham implementação | Removidos controles sem ação; a busca e os filtros de leads continuam disponíveis. Não anunciar essas funções como concluídas |
| F18 | Dependência transitiva `uuid` tinha advisory moderado | Override limitado a `gaxios@6.7.1 → uuid@11.1.1`. Gaxios usa `v4()`, API preservada. Auditoria npm e testes posteriores aprovados |
| F19 | Datas impossíveis, como 30 de fevereiro, eram normalizadas silenciosamente | Validação rejeita data cuja conversão não preserva o dia informado |

Também foram preservados: Google Maps interativo, bandeiras SVG BR/US/ES, inglês como padrão para navegador sem preferência, preferência de idioma local, marca D2 e PDF institucional. A imagem da conta Google volta a aparecer na identificação do usuário, como na aplicação anterior. As novas mensagens foram traduzidas para português, inglês e espanhol.

## Evidências automatizadas

| Camada | Resultado local |
|---|---|
| Frontend | 53 testes, 14 arquivos, aprovados; inclui PDF PT/EN/ES, métricas e CSV |
| Política das Functions | 17 testes aprovados |
| Transações Firestore | 11 testes integrados aprovados no projeto isolado `demo-d2-map-crm` |
| Regras Firestore | 10 testes aprovados no emulador |
| Compilação | Frontend e Functions aprovados |
| Dependências de produção | Frontend e Functions: zero vulnerabilidades reportadas pelo npm nesta execução |
| PDF de exemplo | Gerado pelo script `generate:report-sample`; valores e presença de imagem verificados por teste |

Os testes integrados cobrem alteração de associação legada, convite não verificado, e-mail diferente, revogação, renovação e concorrência de convites, logs adulterados pelo cliente, organização inexistente, módulos, suspensão, leitura e escrita entre equipes, isolamento de organizações, proteção do proprietário, tentativa de autopromoção, identidade enviada pelo cliente, empresas/contatos persistentes, atividades idempotentes, pipeline até ganho, transição inválida, data impossível e limite de carregamento.

Os sete primeiros cenários falharam contra a versão anterior e passaram após a correção. A suite adicional amplia a cobertura; os números de testes não representam uma garantia de ausência de defeitos.

A execução local utiliza Node 24. O backend de produção e a integração contínua utilizam Node 22. A publicação exige aprovação do workflow nesse runtime. O aviso de tamanho do chunk Firebase permanece; não impede a compilação.

## Verificação visual local

- Relatórios conferidos em inglês e espanhol, com inspeção anterior da visão geral em português.
- Negócio demonstrativo de US$ 12.500 encerrado como perdido: pipeline passou de US$ 72.000 para US$ 59.500 e taxa de ganho passou de não disponível para 0%.
- Negócio perdido permaneceu consultável na lista de encerrados após recarga.
- Layout de relatórios inspecionado em desktop e largura móvel de 390 px; bandeiras e navegação preservadas.
- Dados de teste usados no emulador e no modo demonstrativo local; sem criação de vendedores ou registros comerciais fictícios no workspace real.

## O que ainda não está concluído

### 1. Ciclo completo de manutenção comercial

Existem cadastro e consulta de empresas/contatos/leads, criação e conclusão de atividades e avanço/encerramento de oportunidades. **Ainda faltam edição geral desses registros, reatribuição de carteiras e equipes por registro, arquivamento/recuperação e reabertura controlada de negócios na interface.** A seleção de equipe no cadastro usa a primeira equipe de um usuário com escopo de equipes; não há escolha explícita por registro.

Atividades e oportunidades ainda vinculam a empresa pelo nome. É necessário migrar para `companyId` estável antes de depender de consolidação entre empresas homônimas. Não tratar nomes iguais como identidade comercial garantida. A atual última atividade do lead não é uma trilha consolidada de todas as interações.

Critério de encerramento: editar sem perder histórico; autorização e auditoria em toda alteração; IDs relacionais persistentes; reatribuição transacional; testes contra registro de outro vendedor/equipe e colisão de nomes.

### 2. Operação e recuperação

Backup automático, retenção e restauração de dados em ambiente isolado **não foram comprovados nesta rodada**. Retenção de logs, revisão de IAM, alertas de falhas e quotas precisam de evidência operacional. A preferência de idioma atual é por navegador; sincronização entre dispositivos não está implementada.

Critério de encerramento: política registrada, backup efetivo e ensaio de restauração sem alterar a base real. Não declarar “backup disponível” com base apenas no uso do Firebase.

### 3. Proteção de consumo e escala

App Check permanece opcional e não imposto no backend. Restrições/referrers e quotas da chave específica do Maps precisam de verificação atual. O limite comercial atual é 500 documentos por consulta de escopo, sem paginação; o excesso agora produz erro, em vez de números incorretos. Convites/equipes também possuem limites de listagem e precisam de paginação para uso ampliado.

Critério de encerramento: configurar/verificar proteções sem bloquear usuários legítimos, observar tokens App Check válidos antes de enforcement, paginar consultas e definir agregações consistentes. Migração de APIs legadas de Places/Marker é evolução técnica separada; o mapa atual permanece funcional.

### 4. Homologação de usuários reais

Políticas de papéis/equipes foram testadas com identidades simuladas no emulador. Ainda é necessário um ensaio operacional com conta real de vendedor, gestor e leitor: convite, login, criação, recarga, bloqueio cruzado, suspensão e exportação autorizada. Nenhum convite por e-mail é enviado automaticamente: o convite é registrado no CRM e aceito pela conta Google correspondente no próprio aplicativo.

Critério de encerramento: registrar os resultados desse roteiro sem conceder papéis administrativos a contas de teste desnecessariamente.

## Uso e publicação

URL de homologação: https://allcablingtechcorp-coder.github.io/D2-MAP-CRM/

O usuário pode testar os fluxos existentes online após a publicação das correções. **Não interpretar a publicação como conclusão das quatro pendências acima ou autorização técnica para substituir integralmente um CRM operacional.**

Evidência de publicação será registrada no encerramento desta rodada, após confirmação das Functions e do GitHub Pages.

## Execução e custo de modelo

Esta rodada executou a auditoria solicitada. Para a implementação das pendências delimitadas acima, manter **SOL HIGH** é a recomendação operacional para continuidade; não é necessário interromper cada entrega para trocar o modelo. Reservar **Astra HIGH** para revisar a alteração de identidade/atribuição e o parecer final após os critérios de encerramento. Esta recomendação não é garantia de custo ou de ausência de erros.

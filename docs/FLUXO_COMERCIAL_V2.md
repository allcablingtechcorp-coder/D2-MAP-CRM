# Fluxo comercial funcional — D2 CRM V2

## Escopo do marco

Este marco conecta prospecção, leads, pipeline, atividades, empresas, dashboard e relatórios por um único estado de trabalho. Os registros demonstrativos persistem no `localStorage` do navegador para permitir revisão contínua do protótipo. Essa persistência é local, não representa o banco de produção e será substituída por repositórios autenticados após a liberação do Firebase.

## Conversão de prospecção em lead

1. O usuário seleciona uma empresa no mapa de prospecção.
2. A ação **Adicionar como lead** abre o cadastro com empresa, localidade, origem, prioridade e primeira ação preenchidas.
3. O usuário confirma responsável, prioridade e prazo.
4. O domínio valida campos obrigatórios, data e duplicidade exata por empresa e localidade normalizadas.
5. O novo lead passa a aparecer na carteira, em empresas, nos indicadores e nas opções de oportunidade e atividade.

## Gestão de oportunidades

Toda oportunidade nasce em **Descoberta**. O avanço normal segue a ordem:

`Descoberta → Diagnóstico → Proposta → Negociação → Ganho`

O domínio impede saltos de etapa, reabertura direta de negócios encerrados e entrada em proposta, negociação ou ganho sem valor positivo. Uma oportunidade aberta deve manter a próxima ação definida. Negócios ganhos ou perdidos não entram no valor do pipeline aberto.

## Gestão de atividades

O cadastro vincula tipo, assunto, empresa, responsável e vencimento. A conclusão é idempotente: repetir a operação não altera novamente o registro. Os indicadores distinguem atividades pendentes, vencimentos do dia, agenda dos próximos sete dias e concluídas.

## Sincronização entre módulos

O `CrmWorkspaceProvider` mantém leads, oportunidades e atividades em uma fonte comum. Uma alteração é refletida sem recarregar a página:

- dashboard: carteira, pipeline e prioridades;
- leads: busca e tabela operacional;
- pipeline: etapas, quantidades e valores;
- atividades: agenda e conclusão;
- empresas: carteira consolidada e quantidade de negócios;
- relatórios: pipeline aberto, ticket médio aberto e cobertura de atividades.

## Limite de persistência

O armazenamento local usa a chave `d2-crm-demo-workspace-v1`. Ele serve exclusivamente à homologação visual e funcional. Não fornece autenticação, sincronização entre usuários, autorização por organização, trilha confiável nem recuperação de dados. A troca futura deve ocorrer na camada de aplicação, preservando as regras puras em `domain/workflows.ts` e `domain/metrics.ts`.

## Validações automatizadas

Os testes cobrem normalização e duplicidade de leads, campos e datas inválidas, sequência do pipeline, valor obrigatório, bloqueio de reabertura, conclusão idempotente, janelas de atividades, exclusão de negócios encerrados do pipeline e cobertura de atividades limitada à carteira real.

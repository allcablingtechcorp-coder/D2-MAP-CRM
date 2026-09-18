# Status de execução — 18 de setembro de 2026

## Entrega concluída

- Criada a branch `codex/crm-v2-foundation`.
- Criada uma aplicação V2 independente em React e TypeScript.
- Implementado shell profissional com navegação lateral, busca global, contexto de conta e identificação de ambiente demonstrativo.
- Implementados oito módulos navegáveis: visão geral, leads, pipeline, atividades, prospecção, empresas, relatórios e administração.
- Implementado modelo inicial de papéis, permissões, escopos e proteção da conta proprietária.
- Implementados cinco testes de domínio para regras críticas de acesso e um teste estrutural do PDF.
- Validada a compilação de produção.
- Validada a interface em viewport desktop de 1440 × 900 e em viewport móvel.
- Validada a navegação entre dashboard, prospecção e administração, incluindo troca do perfil selecionado.
- Integrado o logo oficial D2 Group ao shell, ao módulo de relatórios e à exportação PDF.
- Criado relatório executivo PDF com pipeline, métricas, oportunidades, origem geográfica, metadados, rodapé e paginação.
- Implementada internacionalização completa da interface e do PDF em português, inglês e espanhol.
- Adicionado seletor de idioma responsivo com preferência persistente e formatação localizada de datas e valores.

## Evidências de validação

| Verificação | Resultado |
|---|---|
| `npm run build` | Aprovado; 1.882 módulos transformados |
| `npm run test` | Aprovado; 3 arquivos e 8 testes |
| Console do navegador | Nenhum erro encontrado nos fluxos inspecionados |
| Desktop | Dashboard, prospecção e administração inspecionados em 1440 × 900 |
| Mobile | Dashboard inspecionado com sidebar recolhida e cartões em uma coluna |
| PDF institucional | A4 renderizado e inspecionado; logo, métricas, tabela, rodapé e paginação aprovados |
| Idiomas | Dashboard e relatórios verificados em PT, EN e ES; exportação em espanhol confirmada |

## Limite técnico identificado

A consulta `firestore:databases:list --project d2-map-crm` retornou HTTP 403 para a sessão Firebase CLI autenticada como `dantefrota@gmail.com`. Portanto, não existem dados suficientes para verificar a edição e a região do Firestore.

Até essa informação ser obtida com uma conta autorizada, regras, índices, modelo persistente, autenticação e migração de produção permanecem deliberadamente fora desta entrega.

## Estado da publicação

A aplicação pública não foi alterada. A V2 está disponível localmente para revisão e usa somente fixtures demonstrativas.

## Próximo marco

Configurar a fundação segura do backend: autenticação, associação do usuário à organização, regras de acesso, logs de auditoria e testes no Emulator Suite. Essa etapa depende do acesso de leitura ao projeto Firebase correto e da confirmação da edição e região do banco.

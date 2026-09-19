# Publicação da D2 CRM V2 no GitHub Pages

## Estado atual verificado

- URL pública: `https://allcablingtechcorp-coder.github.io/D2-MAP-CRM/`
- resposta HTTP: `200 OK`
- origem atual: branch `main`, diretório raiz;
- modo atual do Pages: `legacy`;
- aplicação exibida: versão anterior localizada na raiz do repositório;
- V2: código-fonte localizado em `v2/`, ainda fora da branch `main`.

Mesclar o PR sem trocar a fonte de publicação não ativa a V2, pois o navegador não executa diretamente o código React/TypeScript em `v2/src`.

## Pipeline preparado

O workflow `.github/workflows/deploy-v2-pages.yml` executa:

1. checkout da branch `main`;
2. instalação reproduzível com `npm ci`;
3. testes automatizados;
4. build de produção em `v2/dist`;
5. upload do diretório compilado como artefato do Pages;
6. publicação no ambiente `github-pages`.

O artefato contém `index.html` no nível raiz, conforme exigido pelo GitHub Pages. O `base: "./"` do Vite mantém os caminhos dos ativos compatíveis com o subdiretório `/D2-MAP-CRM/`.

## Ativação

A ativação final exige duas mudanças externas e visíveis:

1. mesclar o PR da V2 na branch `main`;
2. alterar a fonte do GitHub Pages de publicação por branch para **GitHub Actions**.

Depois disso, o workflow deve concluir os jobs `build` e `deploy`. A URL pública deve ser validada em desktop e mobile, nos três idiomas, incluindo criação demonstrativa de lead, atividade e oportunidade e exportação do PDF.

## Escopo da homologação online

Esta publicação expõe somente o protótipo demonstrativo. Os dados ficam no `localStorage` de cada navegador. Usuários diferentes não compartilham dados e não existe autenticação real na V2. O topo da aplicação identifica explicitamente esse estado.

## Reversão

Se a validação online falhar, a reversão consiste em restaurar a fonte do Pages para a branch `main`, diretório raiz. A versão anterior continua preservada nos arquivos `index.html`, `app.js` e `style.css` da raiz.

## Requisitos para produção real

1. recuperar acesso administrativo ao projeto Firebase correto e confirmar edição e região do Firestore;
2. integrar autenticação Google e associação ativa à organização;
3. persistir leads, empresas, oportunidades, atividades, usuários e auditoria;
4. aplicar regras de autorização por papel, escopo e módulo e validá-las no Emulator Suite;
5. migrar a busca Google Maps, dados atuais e listas de supressão, executar homologação e aprovar a troca definitiva.

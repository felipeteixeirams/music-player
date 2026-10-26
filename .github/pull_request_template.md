## O que muda

<!-- O comportamento novo ou corrigido, em poucas linhas. Por que agora. -->

## Domínio e documentação

- [ ] Domínio tocado: integrações e reprodução · contas e dados · design system · outro: ____
- [ ] Li o master e os satélites do domínio (`docs/README.md`) antes de alterar.
- [ ] Atualizei o master/satélite que é dono do que mudou (um fato vive em um lugar só; os outros linkam).
- [ ] Mudou o que vale em algum ambiente? Atualizei a linha na [matriz de compatibilidade](../docs/specs/current/compatibility-matrix.spec.md) (ou "não mudou").
- [ ] Mexi num invariante (`INV-…`)? O teste que o cita continua garantindo a regra, ou criei um novo.

## Verificação

- [ ] `npm run lint`, `npm test` e `npm run test:e2e` passam (resultado: ____).
- [ ] Mudança visível ganhou ou atualizou um teste de ponta a ponta.

## Teste em iPhone

<!-- Reprodução, login, sincronização, tela cheia: diga o que foi testado em aparelho real (modelo, navegador ou app instalado, versão do app da primeira linha do Diagnóstico) e o que NÃO foi. Se nada, escreva "não testado em iPhone". -->

## Riscos e o que reverter

<!-- O que pode quebrar, quem percebe primeiro e como desfazer. -->

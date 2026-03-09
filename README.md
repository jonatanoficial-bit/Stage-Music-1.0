# Stage Music — Live Music Performance

**Build:** 2026-03-09 12:30  
**Versão:** v0.4.1  
**Status:** rebuild premium corrigido

## O que esta build entrega

- layout mobile-first premium
- biblioteca musical com busca e filtros
- visualização de cifra/letra com destaque visual
- modo palco
- auto scroll
- zoom da cifra
- admin para colar cifras do Word
- exportação de `manifest.json`
- fluxo pronto para GitHub Pages

## Como publicar o banco online público

1. Abra `admin/admin.html`
2. Cadastre ou importe as músicas
3. Clique em **Exportar manifesto online**
4. Pegue o arquivo gerado `manifest.json`
5. No GitHub, substitua `content/online-library/manifest.json`
6. Faça commit
7. Aguarde a atualização do GitHub Pages

Depois disso, as cifras públicas ficam visíveis para todos os usuários do site.

## Estrutura da música

Cada música pode conter:
- título
- artista
- tom
- BPM
- capotraste
- tags
- observações
- cifra ou letra em texto

## Observação importante

Nesta fase, o banco online público usa **texto** como formato principal.
PDF continua sendo algo recomendado para biblioteca local do usuário em fases futuras.

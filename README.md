# Stage Music

Aplicativo **mobile-first** em **HTML + CSS + JavaScript vanilla** para músicos, cantores e equipes que precisam organizar:

**Build atual:** 2026-03-09 11:20 BRT  
**Versão:** v0.2.0

- cifras e letras em texto
- banco online público de cifras em texto via GitHub
- partituras / materiais em **PDF**
- ordem do repertório / setlist
- navegação rápida de palco
- conteúdo modular via **DLC / expansões**
- administração local com arquitetura pronta para backend futuro

> Esta entrega é uma base premium pronta para evoluir. O conteúdo demo incluído é fictício para evitar distribuição de repertório protegido por direitos autorais.

---

## Visão geral

O projeto foi pensado para funcionar primeiro no celular, mas também com ótima experiência no desktop web.

### Principais recursos

- **Mobile-first real** com navegação fixa e uso confortável em smartphone
- **Modo palco** com:
  - fonte grande
  - navegação anterior / próxima
  - transposição básica de tom para conteúdo textual
  - auto-scroll
  - tela cheia
  - atalhos de teclado
  - swipe lateral no touch
- **Biblioteca** para visualizar e abrir músicas rapidamente
- **Repertório / setlist** com ordenação simples
- **Suporte a PDF**
  - packs embutidos podem apontar para arquivos PDF da pasta `/content/`
  - conteúdo local enviado pelo Admin é salvo via **IndexedDB**
- **Expansões (DLC)** com manifesto JSON e ativação/desativação
- **Admin local** com:
  - login simples
  - criação/edição de músicas
  - upload de PDF
  - criação/edição de packs locais
  - backup / restauração JSON
- **Offline-friendly** com service worker para shell do app
- **Pronto para GitHub Pages**

---

## Estrutura de pastas

```text
palcopro/
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── icons/
│   │   ├── favicon.svg
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── js/
│       ├── app.js
│       ├── content-manager.js
│       ├── storage.js
│       └── utils.js
├── content/
│   ├── registry.json
│   ├── core/
│   │   └── manifest.json
│   ├── dlc-acustico/
│   │   └── manifest.json
│   └── dlc-coro/
│       └── manifest.json
├── index.html
├── manifest.webmanifest
├── service-worker.js
└── README.md
```

---

## Arquitetura de conteúdo / DLC

O aplicativo usa um registro central em:

- `content/registry.json`

Esse arquivo lista os manifestos de packs embutidos.

Cada pack usa um manifesto como:

```json
{
  "id": "dlc-acustico",
  "name": "DLC Acústico Pocket",
  "version": "1.2.0",
  "description": "Expansão enxuta para voz e violão",
  "songs": [
    {
      "id": "song-001",
      "title": "Minha Música",
      "artist": "Banda",
      "key": "D",
      "bpm": 90,
      "type": "text",
      "format": "cifra",
      "tags": ["voz e violão"],
      "notes": "entrada suave",
      "content": "[Intro]\nD A Bm G"
    }
  ]
}
```

### Tipos de música aceitos

#### 1. Texto / cifra

```json
{
  "type": "text",
  "content": "[Verso]\nD A Bm G"
}
```

#### 2. PDF / partitura

Para conteúdo embutido:

```json
{
  "type": "pdf",
  "pdfUrl": "./content/meu-pack/assets/partitura.pdf"
}
```

Para conteúdo local, o Admin salva o arquivo no navegador e registra a referência automaticamente.

### Instalação / ativação de expansão

Existem dois fluxos:

1. **Pack embutido**: listado em `registry.json`
2. **Pack local/importado**: instalado pela interface via JSON

O app mantém ativação/desativação separada do core.

---

## Área Admin

### Login inicial

Senha demo inicial:

```text
palco123
```

Troque a senha logo no primeiro acesso.

### O que o Admin já faz

- criar música textual
- criar música com PDF
- editar / remover música local
- criar / editar packs locais
- exportar pack local
- exportar backup completo
- restaurar backup
- limpar apenas dados locais do navegador

### Armazenamento atual

- **localStorage**
  - preferências de UI
  - packs locais
  - estado de ativação de DLCs
  - repertório atual
  - sessão admin simples
- **IndexedDB**
  - arquivos PDF enviados localmente

### Evolução futura

A camada atual já separa:

- UI
- gerenciamento de conteúdo
- persistência

Isso facilita trocar o armazenamento local por:

- API REST
- Firebase
- Supabase
- backend próprio com autenticação

sem reescrever o front inteiro.

---

## Como rodar localmente

Como o projeto usa `fetch()` para manifestos JSON, rode com um servidor local.

### Opção 1: Python

```bash
cd palcopro
python -m http.server 8000
```

Depois abra:

```text
http://localhost:8000
```

### Opção 2: VS Code Live Server

- abra a pasta no VS Code
- clique em **Open with Live Server**

---

## Publicação no GitHub Pages

### Método simples

1. Crie um repositório no GitHub
2. Envie os arquivos desta pasta
3. No GitHub, vá em:
   - **Settings**
   - **Pages**
4. Em **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: `main` (ou `master`)
   - Folder: `/root`
5. Salve

Depois disso, o GitHub Pages servirá o `index.html` normalmente.

### Observações

- O app funciona como site estático
- Conteúdo local salvo no navegador não é enviado ao GitHub automaticamente
- O backup JSON serve para migrar dados locais entre navegadores/dispositivos

---

## Fluxo recomendado de uso

### Para o músico

1. Abra a **Biblioteca**
2. Adicione músicas ao **Repertório**
3. Ajuste a ordem
4. Vá para **Modo palco**
5. Use atalhos para avançar, voltar, aumentar fonte e transpor

### Para o administrador

1. Entre no **Admin**
2. Crie packs locais ou use o pack padrão local
3. Cadastre músicas em texto ou PDF
4. Exporte packs / backups para segurança

---

## Atalhos no modo palco

- `Espaço` ou `]` → próxima música
- `Backspace` ou `[` → música anterior
- `+` / `-` → aumenta ou diminui a fonte
- `T` / `G` → sobe ou desce o tom
- `S` → liga/desliga auto-scroll
- `F` → alterna tela cheia

No celular, também há **swipe lateral** para navegar entre músicas.

---

## Personalização rápida

### Alterar branding

Edite:

- `index.html` → nome e textos da interface
- `manifest.webmanifest` → nome do app
- `assets/icons/` → ícones

### Alterar tema visual

Edite as variáveis CSS em:

- `assets/css/styles.css`

Principalmente:

- `--primary`
- `--accent`
- `--warm`
- `--bg`
- `--text`

### Trocar conteúdo demo

Edite os manifestos em:

- `content/core/manifest.json`
- `content/dlc-acustico/manifest.json`
- `content/dlc-coro/manifest.json`

---

## Decisões assumidas nesta entrega

Como a descrição funcional ainda estava aberta, foram assumidas as seguintes escolhas sensatas:

- nome de trabalho do produto: **Palco Pro**
- projeto como **web app estático premium**, pronto para GitHub Pages
- armazenamento local como primeira fase
- suporte a texto + PDF com preferência por PDF no fluxo de conteúdo real
- estrutura de DLC baseada em manifesto JSON
- login admin local simples, preparado para evoluir depois

---

## Próximos upgrades sugeridos

1. autenticação real com backend
2. sincronização em nuvem entre dispositivos
3. múltiplos repertórios salvos
4. arrastar e soltar para reordenar faixas
5. marcação de trechos / bookmarks em PDF
6. metrônomo embutido
7. suporte a notas por músico/instrumento
8. importação de PDF em lote
9. modo colaborativo para banda/equipe
10. PWA com cache avançado de assets de partitura

---

## Observação importante sobre direitos autorais

Este repositório deve receber apenas conteúdo autorizado pelo usuário. As músicas demo incluídas são fictícias e servem apenas para demonstrar estrutura, UX e arquitetura.



## Banco online público via GitHub

Esta build já deixa o fluxo pronto para o seu cenário sem custo inicial.

### Como funciona

- o administrador cria músicas em **texto** no pack local **Banco online público**
- no Admin, use o botão **Exportar manifesto online**
- o app baixa um arquivo JSON pronto
- no GitHub, substitua o arquivo `content/online-library/manifest.json` por esse JSON
- depois do commit, todos os usuários verão as cifras online ao recarregar o site

### Recomendação importante

- **texto/cifra** = melhor para a biblioteca online pública
- **PDF** = melhor para armazenamento local do usuário

Assim você mantém o projeto leve, gratuito e fácil de publicar no GitHub Pages.

## Progresso do projeto

- Fases totais previstas: **8**
- Fase atual concluída nesta build: **Fase 2 + base do banco online público**
- Progresso estimado: **22%**

## Nome da build

`stage-music-build-2026-03-09-1120.zip`

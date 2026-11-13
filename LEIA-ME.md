# Gestão de Leads | Controle de Aquisição — UniFatecie

Sistema web para conferência diária de leads por canal de aquisição (CRM × planilha), com dashboard, histórico, relatórios, exportação e controle de acesso.

**Tecnologias:** React + TypeScript · Tailwind CSS · Supabase (PostgreSQL + Auth + RLS) · Recharts · SheetJS (Excel) · jsPDF (PDF)

---

## 1. O que você precisa fornecer

Somente **2 informações** do seu projeto Supabase (Supabase → *Project Settings* → *API*):

| Variável | Onde encontrar |
|---|---|
| `VITE_SUPABASE_URL` | *Project URL* (ex.: `https://abcdxyz.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | *Project API keys* → `anon` `public` |

> A chave `anon` é pública por natureza: a segurança dos dados é garantida pelas políticas RLS do banco. **Nunca** use a chave `service_role` no front-end.

---

## 2. Passo a passo de instalação

### 2.1 Criar o projeto no Supabase
1. Acesse <https://supabase.com>, crie uma conta e um novo projeto (região *South America (São Paulo)*).
2. Aguarde o projeto ficar pronto.

### 2.2 Criar o banco de dados
1. No painel do Supabase, abra **SQL Editor** → **New query**.
2. Copie todo o conteúdo de `supabase/migrations/20261109000000_schema_inicial.sql`, cole e clique em **Run**.
3. Isso cria tabelas, os 6 canais iniciais, regras, auditoria e as políticas de segurança.

(Alternativa para quem usa a Supabase CLI: `supabase link` e `supabase db push`.)

### 2.3 Configurar a autenticação
Em **Authentication → Sign In / Providers → Email**:
- Mantenha **Email** habilitado.
- **Confirm email**: recomendado *desligar* para uso interno (o gestor cria os usuários com senha e eles já entram). Se deixar ligado, cada usuário precisa confirmar o e-mail antes do primeiro acesso.

Em **Authentication → URL Configuration**, informe em *Site URL* o endereço onde o sistema ficará publicado (ex.: `https://leads.suaempresa.com.br`) — necessário para o link de "Esqueci minha senha".

### 2.4 Rodar o sistema
Requer Node.js 18+.

```bash
cp .env.example .env        # e preencha as duas variáveis
npm install
npm run dev                 # desenvolvimento: http://localhost:5173
npm run build               # gera a versão de produção em dist/
```

### 2.5 Publicar (opcional, recomendado)
Funciona em qualquer hospedagem de sites estáticos. Exemplo com **Vercel**: importe a pasta/repositório, defina as duas variáveis em *Environment Variables* e publique (o arquivo `vercel.json` já trata as rotas). Na Netlify, o arquivo `public/_redirects` já está pronto.

### 2.6 Primeiro acesso
1. Abra o sistema e clique em **Solicitar cadastro**.
2. **O primeiro usuário cadastrado vira automaticamente Administrador/Gestor** e já entra no sistema.
3. Depois, em **Usuários → Novo usuário**, cadastre os atendentes (nome, e-mail, senha inicial e nível de acesso).
4. Pessoas que se cadastrarem sozinhas pela tela de login ficam **aguardando aprovação** até um gestor liberar em *Usuários*.

---

## 3. Funcionalidades

| Área | O que faz |
|---|---|
| **Lançamento Diário** | Data padrão = ontem; tabela com todos os canais; diferença calculada na hora (CRM − Planilha); verde/laranja/vermelho por situação; totais e resumo do dia; observação por canal; botão **SALVAR CONFERÊNCIA DO DIA**; aviso de alterações não salvas; Enter avança para o próximo campo; layout em cartões no celular |
| **Dashboard** | 5 indicadores do período, alerta de divergências, dias pendentes (clicáveis), ranking de canais por volume e por divergência, divergências recorrentes, 5 gráficos |
| **Histórico** | Todos os dias do período (inclusive pendentes), filtro por status, detalhe por dia com canais, observações e **histórico de alterações** (quem mudou, quando, valor antes → depois) |
| **Relatórios** | Resumo do período, tabela por canal, % de participação e de divergência, histórico diário, observações, detalhamento dia × canal, **comparação entre dois dias**, exportação **Excel / PDF / CSV** e **impressão** |
| **Canais de Aquisição** | Criar, renomear, reordenar, desativar/reativar (histórico preservado) e excluir canais sem lançamentos; **histórico completo de cada canal** |
| **Usuários** | Criar usuários, aprovar cadastros, alterar nível (Gestor/Atendente), desativar acesso |
| **Configurações** | Troca de senha; parâmetros: dias para divergência "recorrente", prazo de edição para atendentes, considerar fins de semana nas pendências |

### Filtros de período
Hoje · Ontem · Últimos 7/15/30 dias (incluindo hoje) · Este mês · Mês anterior · Data específica · Período personalizado. O filtro escolhido vale para Dashboard, Histórico, Relatórios e histórico do canal, e é respeitado nas exportações.

### Regras de status do dia
- **PENDENTE** – nenhuma conferência salva.
- **EM CONFERÊNCIA** – há dados, mas algum canal está com CRM ou planilha vazio.
- **CONFERIDO** – todos os canais com os dois números preenchidos (zero conta como preenchido) e sem diferença.
- **COM DIVERGÊNCIA** – todos preenchidos e pelo menos um canal com diferença.

### Permissões
| | Gestor | Atendente |
|---|---|---|
| Lançar e editar conferências | ✔ | ✔ (respeitando o prazo configurado) |
| Excluir conferências (com confirmação) | ✔ | ✘ |
| Dashboard, Relatórios, Canais, Usuários | ✔ | ✘ |
| Histórico | todos os registros | "Meus Lançamentos" |

---

## 4. Segurança e confiabilidade dos dados
- **Uma conferência por data**, garantida no banco (`unique`). Os dias nunca se sobrepõem.
- Gravação feita por uma função transacional (`salvar_conferencia`): valida permissões, data futura, valores negativos e campos vazios, e calcula o status no servidor.
- **Controle de edição simultânea:** se dois usuários editarem o mesmo dia, o segundo recebe um aviso para recarregar em vez de sobrescrever o trabalho do outro.
- Campos vazios ficam `NULL` no banco (não viram zero).
- **Auditoria automática** de toda inclusão/alteração; exclusões guardam uma cópia completa dos números. Nada é apagado automaticamente.
- RLS ativo em todas as tabelas: usuários inativos ou não autenticados não leem nem gravam nada; escrita em conferências só pelas funções do banco.
- Não é possível remover/rebaixar o último administrador.

---

## 5. Estrutura do projeto
```
supabase/migrations/   SQL do banco (tabelas, funções, triggers, RLS)
src/lib/               cálculos, datas, acesso a dados, exportações
src/contexts/          autenticação, período/canais/configurações, mensagens
src/components/        layout, filtro de período, gráficos, componentes de UI
src/pages/             telas do sistema
tests/                 testes automatizados (npm test) e testes SQL
```

## 6. Testes
- `npm test` — cálculos, regras de status e filtros de data.
- `tests/sql/` — testes de permissões e regras do banco (executados em PostgreSQL 16).

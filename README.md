# Desafio DevOps 2025

Duas aplicações web em linguagens diferentes, com cache por camada de proxy Nginx, infraestrutura completa via Docker Compose e observabilidade com Prometheus + Grafana.

---

## Arquitetura

```
                          ┌────────────────────────────────────────────────────────┐
                          │                    Docker Compose                      │
                          │                                                        │
  Cliente/Browser  ──────►│  Nginx :8080                                          │
                          │  ├── /app1/*  → cache 10s → App1 (Python:5000)        │
                          │  └── /app2/*  → cache 60s → App2 (Node.js:3000)       │
                          │                                                        │
                          │  Observabilidade                                       │
                          │  ├── Prometheus :9090  ← nginx-exporter + cAdvisor    │
                          │  └── Grafana    :3001  ← Prometheus                   │
                          └────────────────────────────────────────────────────────┘
```

### Redes internas

| Rede       | Serviços                          |
|------------|-----------------------------------|
| `backend`  | nginx, app1, app2                 |
| `monitoring` | nginx, nginx-exporter, cadvisor, prometheus, grafana |

---

## Rotas disponíveis

| URL                            | App         | Resposta                        | Cache  |
|-------------------------------|-------------|----------------------------------|--------|
| `http://localhost:8080/app1/`      | Python Flask | Texto fixo                       | 10s    |
| `http://localhost:8080/app1/time`  | Python Flask | Horário atual do servidor        | 10s    |
| `http://localhost:8080/app2/`      | Node.js      | Texto fixo                       | 60s    |
| `http://localhost:8080/app2/time`  | Node.js      | Horário atual do servidor        | 60s    |
| `http://localhost:9090`            | Prometheus   | Interface de métricas            | —      |
| `http://localhost:3001`            | Grafana      | Dashboards (admin/admin)         | —      |

---

## Pré-requisitos

- Docker >= 24.x
- Docker Compose >= 2.x (plugin `docker compose`)
- Git

---

## Como executar

### 1. Clonar o repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd desafio-devops
```

### 2. Subir toda a infraestrutura

```bash
docker compose up -d --build
```

Esse único comando irá:
- Buildar as imagens das duas aplicações
- Subir o Nginx com as regras de cache configuradas
- Subir Prometheus, Grafana, nginx-exporter e cAdvisor

### 3. Verificar se todos os containers estão rodando

```bash
docker compose ps
```

Todos os serviços devem aparecer com status `running`.

### 4. Testar as aplicações

```bash
# App 1 - Python (texto fixo)
curl -i http://localhost:8080/app1/

# App 1 - Python (horário)
curl -i http://localhost:8080/app1/time

# App 2 - Node.js (texto fixo)
curl -i http://localhost:8080/app2/

# App 2 - Node.js (horário)
curl -i http://localhost:8080/app2/time
```

### 5. Verificar o cache

No header da resposta, observe o campo `X-Cache-Status`:

- `MISS` → primeira requisição, passou pela aplicação
- `HIT`  → resposta veio do cache do Nginx

```bash
# Primeira chamada (MISS)
curl -i http://localhost:8080/app1/time
# Header: X-Cache-Status: MISS

# Segunda chamada em menos de 10s (HIT)
curl -i http://localhost:8080/app1/time
# Header: X-Cache-Status: HIT
```

### 6. Acessar o Grafana

- URL: http://localhost:3001
- Usuário: `admin`
- Senha: `admin`

Após o login, configure o datasource:
1. Vá em **Connections > Data sources > Add data source**
2. Selecione **Prometheus**
3. URL: `http://prometheus:9090`
4. Clique em **Save & Test**

Importe um dashboard pronto de Nginx (ID `12708`) ou cAdvisor (ID `14282`) pelo menu **Dashboards > Import**.

---

## Parar a infraestrutura

```bash
docker compose down
```

Para remover também os volumes (dados do Prometheus e Grafana):

```bash
docker compose down -v
```

---

## Estrutura do projeto

```
desafio-devops/
├── app1-python/
│   ├── app.py              # Aplicação Flask com 2 rotas
│   ├── requirements.txt
│   └── Dockerfile
├── app2-node/
│   ├── app.js              # Aplicação Express com 2 rotas
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   └── nginx.conf          # Proxy reverso + cache (10s e 60s)
├── monitoring/
│   └── prometheus/
│       └── prometheus.yml  # Scrape de métricas
├── docker-compose.yml      # Orquestração completa
└── README.md
```

---

## Análise e pontos de melhoria

### Melhorias imediatas (baixo custo)

1. **Health checks nos containers** — Adicionar `healthcheck` no `docker-compose.yml` para cada serviço, garantindo que o Nginx só receba tráfego quando as apps estiverem prontas.

2. **Limitar recursos** — Definir `mem_limit` e `cpus` nos serviços para evitar que um container consuma todos os recursos do host.

3. **Variáveis de ambiente** — Mover configurações sensíveis (senha do Grafana, portas) para um arquivo `.env`.

4. **Logs estruturados** — Configurar o Nginx para emitir logs em formato JSON, facilitando ingestão em stacks de log (ELK, Loki+Grafana).

### Melhorias para ambiente produtivo

5. **Redis como cache externo** — Substituir o cache em memória do Nginx por Redis, permitindo compartilhamento entre múltiplas réplicas do Nginx e persistência entre reinicializações.

6. **Múltiplas réplicas das apps** — Escalar `app1` e `app2` com `deploy.replicas` (Docker Swarm) ou migrar para Kubernetes (AKS/EKS) para alta disponibilidade real.

7. **TLS/HTTPS** — Adicionar certificados SSL no Nginx (Let's Encrypt via Certbot ou cert-manager no K8s).

8. **Pipeline CI/CD** — Criar pipeline no GitHub Actions ou Azure DevOps para: lint + testes → build da imagem → push para registry → deploy automático.

9. **Registry de imagens** — Publicar as imagens no Docker Hub, GitHub Container Registry ou Azure Container Registry em vez de buildar localmente.

10. **Alertas no Grafana** — Configurar alertas para latência alta, taxa de erro elevada ou containers não saudáveis, com notificação via Slack/e-mail.

---

## Fluxo de atualização

### Atualização do código das aplicações

```
Developer → git push → CI (build + test) → nova imagem no registry
→ docker compose pull && docker compose up -d --no-deps --build app1
```

No ambiente produtivo (K8s):
```
kubectl set image deployment/app1 app1=registry/app1:nova-versao
```

### Atualização da infraestrutura (Nginx, Prometheus, Grafana)

```
1. Alterar nginx.conf ou docker-compose.yml
2. git commit + push
3. docker compose up -d --force-recreate nginx
```

No K8s, via Helm ou Terraform aplicando o novo estado declarativo.

### Atualização sem downtime (zero-downtime deploy)

Com múltiplas réplicas e um load balancer, é possível fazer rolling update:
1. Sobe nova versão em paralelo
2. Load balancer migra tráfego gradualmente
3. Versão antiga é removida somente após health check bem-sucedido

---

## Diagrama de fluxo de atualização

```
┌─────────────┐    push     ┌──────────────┐   build/test  ┌──────────────┐
│  Developer  │ ──────────► │  Git (GitHub)│ ────────────► │   CI/CD      │
└─────────────┘             └──────────────┘               └──────┬───────┘
                                                                   │ nova imagem
                                                                   ▼
                                                          ┌──────────────────┐
                                                          │  Container       │
                                                          │  Registry        │
                                                          └────────┬─────────┘
                                                                   │ deploy
                                                                   ▼
                                                          ┌──────────────────┐
                                                          │  Docker Compose  │
                                                          │  ou Kubernetes   │
                                                          └──────────────────┘
```
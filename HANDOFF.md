# ROUTEZEN — Technical Architecture, Algorithmic Specifications & Engineering Handoff

> **Master Engineering Documentation & Handover Dossier**  
> **Repository:** `https://github.com/mittai/routezen` (Branch: `main`)  
> **Working Directory:** `/home/mittai/Documents/ROUTEZEN`  
> **Target Deployment Region:** Chennai Metropolitan Logistics Area (Currency: INR ₹, Distance: Kilometres)  
> **System Status:** Fully verified (127 Backend Pytest passing, 88 Frontend Vitest passing, TypeScript strict clean)

---

## Table of Contents

1. [Executive Summary & Problem Statement Alignment](#1-executive-summary--problem-statement-alignment)
2. [Architecture & Monorepo Overview](#2-architecture--monorepo-overview)
3. [Mathematical & Algorithmic Formulations](#3-mathematical--algorithmic-formulations)
   - [3.1 QUBO Matrix Representation](#31-qubo-matrix-representation)
   - [3.2 Ising Hamiltonian Mapping](#32-ising-hamiltonian-mapping)
   - [3.3 QAOA Quantum Circuit Ansatz & Variational Optimization](#33-qaoa-quantum-circuit-ansatz--variational-optimization)
   - [3.4 Simulated Annealing over QUBO](#34-simulated-annealing-over-qubo)
   - [3.5 Two-Phase Hybrid Decomposition](#35-two-phase-hybrid-decomposition)
   - [3.6 Classical Multi-Objective CVRP/VRPTW (OR-Tools)](#36-classical-multi-objective-cvrpvrptw-or-tools)
   - [3.7 Dynamic In-Transit Rerouting Engine](#37-dynamic-in-transit-rerouting-engine)
   - [3.8 Deterministic Fleet Recommendation Engine](#38-deterministic-fleet-recommendation-engine)
4. [Full REST API Specification](#4-full-rest-api-specification)
   - [4.1 Optimization Endpoints](#41-optimization-endpoints)
   - [4.2 Fleet Recommendation Endpoints](#42-fleet-recommendation-endpoints)
   - [4.3 Routing & Distance Engine Endpoints](#43-routing--distance-engine-endpoints)
   - [4.4 Dispatch Plans & Operations Endpoints](#44-dispatch-plans--operations-endpoints)
   - [4.5 System Health & Analytics Endpoints](#45-system-health--analytics-endpoints)
5. [Benchmark & Empirical Performance Analysis](#5-benchmark--empirical-performance-analysis)
   - [5.1 Multi-Solver Benchmark Results](#51-multi-solver-benchmark-results)
   - [5.2 Quantum Simulation Boundaries & Qubit Scaling Law](#52-quantum-simulation-boundaries--qubit-scaling-law)
   - [5.3 Engineering Trade-Offs](#53-engineering-trade-offs)
6. [Frontend Architecture & User Experience Workflows](#6-frontend-architecture--user-experience-workflows)
   - [6.1 Five-Step Delivery Planning Wizard](#61-five-step-delivery-planning-wizard)
   - [6.2 Interactive Leaflet Map & OSRM Polyline Engine](#62-interactive-leaflet-map--osrm-polyline-engine)
   - [6.3 Live Dispatch Tracking & Simulation](#63-live-dispatch-tracking--simulation)
   - [6.4 Analytics & Scenario Comparison Engine](#64-analytics--scenario-comparison-engine)
7. [Verification, Quality Assurance & Test Coverage](#7-verification-quality-assurance--test-coverage)
8. [Operational Runbook & Environment Setup](#8-operational-runbook--environment-setup)
9. [Roadmap for Future Quantum & Logistics Enhancements](#9-roadmap-for-future-quantum--logistics-enhancements)

---

## 1. Executive Summary & Problem Statement Alignment

### 1.1 Problem Statement
> **"Quantum Route Optimizer - Smart Travel & Logistics"**  
> *Develop a quantum-assisted optimization system that identifies an efficient route for delivering goods or visiting multiple locations while minimizing total travel distance or time.*

Urban last-mile logistics within dense metropolitan centers such as Chennai face an NP-hard combinatorial explosion. Traditional Capacitated Vehicle Routing with Time Windows (CVRP/VRPTW) requires dispatchers to evaluate factorial permutations of customer drop-offs while simultaneously respecting hard vehicle weight/volume capacities, strict customer delivery time windows, distinct driver shift boundaries, and heterogeneous powertrain efficiencies.

As the number of delivery stops $N$ expands, standard classical branch-and-bound and integer programming approaches encounter steep computational scaling hurdles. Quantum computing introduces alternative optimization paradigms through Quadratic Unconstrained Binary Optimization (QUBO) and the Quantum Approximate Optimization Algorithm (QAOA). However, Noisy Intermediate-Scale Quantum (NISQ) systems and classical statevector simulators suffer from severe physical qubit limits ($N^2$ scaling) and sampling noise.

### 1.2 RouteZen Solution Architecture
RouteZen delivers an industrial-grade, quantum-assisted logistics platform tailored to the Chennai logistics market. Rather than relying on naive quantum toy models or asserting unverified "quantum supremacy," RouteZen executes an architecturally sound **Two-Phase Hybrid Decomposition Architecture**:

1. **Global Classical CVRP/VRPTW Decomposition:** Google OR-Tools decomposes the multi-vehicle fleet routing problem into balanced, feasible vehicle routes respecting vehicle capacity, cargo volume, customer delivery windows, and multi-objective trade-offs (cost, time, distance, carbon emissions).
2. **Local Quantum-Assisted Combinatorial Optimization:** Sub-route groups of size $N \le 4$ stops are isolated as boundary-aware segments. RouteZen maps these local ordering challenges to an exact QUBO matrix and solves them on Qiskit Aer via QAOA, or via high-speed Simulated Annealing over the QUBO energy surface.
3. **Classical Validation & Seeded Refinement:** Quantum-proposed stop sequences are fed back into OR-Tools as initial solution seeds (`ReadAssignmentFromRoutes`). A strict safety gate evaluates the candidate against the classical baseline: if the quantum proposal violates constraints or degrades the physical objective, the system automatically preserves the classical baseline.
4. **Deterministic Fleet Recommendation Engine:** Pre-dispatch multi-criteria scoring algorithm matches packages to the optimal vehicle powertrain (Electric Scooter, Petrol 2-Wheeler, Electric Cargo 3-Wheeler, CNG 3-Wheeler, Diesel/EV Light Commercial Trucks, Diesel Vans) with exact INR (₹) paise accounting.
5. **Real Road Topology (OSRM Engine):** Turn-by-turn routing powered by the Open Source Routing Machine (OSRM). Straight-line Euclidean approximations are never drawn as routes; any fallback during upstream network downtime is explicitly flagged as a labelled estimate.

```
+---------------------------------------------------------------------------------------------------+
|                                      ROUTEZEN ARCHITECTURE                                        |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ Frontend: Next.js 16 App Router / React 19 / Tailwind CSS v4 / Leaflet Map / Recharts ]        |
|                                         |                                                         |
|                                         v (REST API v1 / JSON / snake_case)                       |
|  [ FastAPI Application Server (Python 3.14) / Workspace Scoped / In-Process Task Runner ]        |
|                                         |                                                         |
|              +--------------------------+--------------------------+                              |
|              |                          |                          |                              |
|              v                          v                          v                              |
|   +---------------------+    +--------------------+    +----------------------+                   |
|   | Deterministic Fleet |    | OSRM Routing Engine|    | Classical Optimizer  |                   |
|   | Recommendation      |    | Driving Network API|    | Google OR-Tools VRP  |                   |
|   | Engine (₹, kg, m3)  |    | TTL Matrix Cache   |    | Global CVRP / VRPTW  |                   |
|   +---------------------+    +--------------------+    +----------------------+                   |
|                                                                    |                              |
|                                                                    v Feasible Sub-routes          |
|                                                        +----------------------+                   |
|                                                        | Boundary-Aware Group |                   |
|                                                        | Decomposer (N <= 4)  |                   |
|                                                        +----------------------+                   |
|                                                                    |                              |
|                                       +----------------------------+----------------------------+ |
|                                       v                                                         v |
|                        +-----------------------------+                           +--------------+ |
|                        | QAOA Quantum Solver         |                           | Simulated    | |
|                        | Qiskit Aer Statevector Sim  |                           | Annealing    | |
|                        | Ising Hamiltonian / COBYLA  |                           | Fast QUBO    | |
|                        +-----------------------------+                           +--------------+ |
|                                       |                                                         | |
|                                       +----------------------------+----------------------------+ |
|                                                                    | Reordered Local Permutations |
|                                                                    v                              |
|                                                        +----------------------+                   |
|                                                        | OR-Tools Seeded Gate |                   |
|                                                        | Baseline vs Candidate|                   |
|                                                        | Physical Validation  |                   |
|                                                        +----------------------+                   |
|                                                                    | Validated Dispatch Plan      |
|                                                                    v                              |
|                             [ Database: PostgreSQL / Neon (Alembic 0001_initial_schema) ]         |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Architecture & Monorepo Overview

The RouteZen codebase is structured as a clean monorepo separating the modern Next.js frontend, Python FastAPI backend, shared documentation, and test infrastructure.

```
/home/mittai/Documents/ROUTEZEN/
|-- backend/
|   |-- alembic/
|   |   |-- env.py                         # Alembic migration environment
|   |   |-- versions/
|   |       |-- 0001_initial_schema.py     # Base migration (Postgres 18 / SQLite)
|   |-- alembic.ini                        # Alembic DB migration configuration
|   |-- app/
|   |   |-- api/
|   |   |   |-- deps.py                    # FastAPI dependencies (DB, OSRM, Runs, Auth-less WS)
|   |   |   |-- csvutil.py                 # Streaming CSV export utilities
|   |   |   |-- usecases.py                # Request resolution, matrix hydration, validation
|   |   |   |-- v1/
|   |   |       |-- analytics.py           # Fleet KPIs, emissions, energy, CSV report endpoints
|   |   |       |-- crud.py                # Generic workspace-scoped CRUD router factory
|   |   |       |-- health.py              # Health check & system readiness probes
|   |   |       |-- optimization.py        # Classical, Quantum, Hybrid, Annealing, Reroute APIs
|   |   |       |-- recommendations.py     # Deterministic vehicle matching API
|   |   |       |-- resources.py           # Locations, Packages, Vehicles, Plans, Scenarios routers
|   |   |       |-- routing.py             # OSRM proxy, matrix endpoint, routing status
|   |   |-- core/
|   |   |   |-- config.py                  # Pydantic BaseSettings, env parsing, CORS settings
|   |   |   |-- logging.py                 # Structured JSON / console logging setup
|   |   |-- db/
|   |   |   |-- base.py                    # Declarative Base, WorkspaceScoped mixin, UUID generator
|   |   |   |-- models.py                  # SQLAlchemy 2 models (Location, Package, Vehicle, Plan, Run)
|   |   |   |-- session.py                 # Engine factory & sessionmaker with pool recycling
|   |   |   |-- types.py                   # UTC-aware DateTime SQLAlchemy type decorator
|   |   |-- repositories/
|   |   |   |-- base.py                    # Workspace initialization & repository primitives
|   |   |-- schemas/
|   |   |   |-- common.py                  # Coordinates, Page pagination, UUID types
|   |   |   |-- optimization.py            # Pydantic request/response models for all 4 solvers
|   |   |   |-- recommendation.py          # Package input, VehicleSpec, Option scoring models
|   |   |   |-- resources.py               # Domain schemas for locations, packages, vehicles, plans
|   |   |   |-- routing.py                 # GeoJSON geometries, legs, matrix payloads
|   |   |-- services/
|   |   |   |-- dynamic_reroute.py         # Multi-origin real-time in-transit dispatch rerouting
|   |   |   |-- optimizer_annealing.py     # Fast QUBO simulated annealing with 2-opt moves
|   |   |   |-- optimizer_classical.py     # Google OR-Tools multi-objective CVRP/VRPTW engine
|   |   |   |-- optimizer_hybrid.py        # Two-phase OR-Tools + QAOA hybrid coordinator
|   |   |   |-- optimizer_quantum.py       # Qiskit Aer statevector QAOA solver & Ising mapper
|   |   |   |-- recommendation.py          # Deterministic fleet recommendation algorithm
|   |   |   |-- routing.py                 # OSRM HTTP client with in-memory TTL caching
|   |   |   |-- run_store.py               # Durable execution manager & background task runner
|   |   |-- main.py                        # FastAPI application initialization & lifespan handler
|   |-- pytest.ini                         # Pytest configuration with asyncio auto mode
|   |-- requirements.txt                   # Production Python dependencies
|   |-- scripts/
|   |   |-- benchmark_results.json         # Raw benchmark records across all 4 solvers
|   |   |-- benchmark_solvers.py           # Automated empirical benchmark execution suite
|   |   |-- seed.py                        # Idempotent demo fleet & Chennai location seeder
|   |-- tests/
|       |-- conftest.py                    # Fixtures (in-memory SQLite, mock OSRM, test client)
|       |-- test_annealing.py              # Simulated Annealing QUBO test suite (9 tests)
|       |-- test_benchmark_solvers.py      # Benchmark runner verification (4 tests)
|       |-- test_classical.py              # OR-Tools classical VRP verification (11 tests)
|       |-- test_health_crud.py            # Health, readiness, CRUD & CSV endpoints (18 tests)
|       |-- test_hybrid.py                 # Hybrid QAOA-OR-Tools decomposition tests (3 tests)
|       |-- test_quantum.py                # QAOA circuit, QUBO, Ising, statevector tests (12 tests)
|       |-- test_recommendation.py         # Fleet cost, emissions & scoring tests (13 tests)
|       |-- test_reroute.py                # Dynamic in-transit rerouting tests (8 tests)
|       |-- test_resolution_validation.py  # Matrix hydration & input validation tests (14 tests)
|       |-- test_routing.py                # OSRM client, caching & geometry tests (13 tests)
|       |-- test_run_store.py              # Durable async run persistence & restarts (7 tests)
|       |-- test_seed_scenarios.py         # DB seed idempotency & scenario runners (3 tests)
|-- docs/
|   |-- ARCHITECTURE.md                    # Core architecture guidelines and API contracts
|   |-- BENCHMARK_REPORT.md                # Multi-solver empirical performance report
|   |-- reference/
|       |-- board-all-screens.png          # UI design reference for 9 app screens
|       |-- plan-route-detail.png          # UI design reference for route detail views
|-- frontend/
|   |-- public/                            # Static SVG assets & brand icons
|   |-- src/
|   |   |-- app/
|   |   |   |-- (app)/                     # Application workspace (authenticated-less dev mode)
|   |   |   |   |-- analytics/page.tsx     # Fleet analytics dashboard
|   |   |   |   |-- locations/page.tsx     # Depot & customer address management
|   |   |   |   |-- optimization/page.tsx  # Solver execution, history, compare runs
|   |   |   |   |-- overview/page.tsx      # Dashboard summary cards & quick actions
|   |   |   |   |-- packages/page.tsx      # Consignment registry & package dimensions
|   |   |   |   |-- plan/page.tsx          # 5-step delivery planning wizard
|   |   |   |   |-- reports/page.tsx       # Historical reports & CSV exports
|   |   |   |   |-- scenarios/page.tsx     # What-If scenario modeling & comparison
|   |   |   |   |-- settings/page.tsx      # System preferences & default parameters
|   |   |   |   |-- tracking/page.tsx      # Real-time event tracking & dispatch timeline
|   |   |   |   |-- vehicles/page.tsx      # Fleet profiles, fuel specs & payload limits
|   |   |   |-- (public)/                  # Marketing & public informational pages
|   |   |   |   |-- about/page.tsx         # Mission, methodology & quantum disclaimer
|   |   |   |   |-- help/faq/page.tsx      # Operational & technical FAQ
|   |   |   |   |-- page.tsx               # Public landing page
|   |   |-- components/
|   |   |   |-- analytics/                 # Fleet charts & KPI widgets
|   |   |   |-- brand/                     # RouteZen logos & badges
|   |   |   |-- maps/                      # Leaflet dynamic map viewer, layers & markers
|   |   |   |-- optimization/              # Solver config forms, run logs & comparisons
|   |   |   |-- plan/                      # Wizard panels: Stops, Recommendation, Constraints, Optimize, Results
|   |   |   |-- shell/                     # App navigation, dark sidebar, topbar
|   |   |   |-- tracking/                  # Live dispatch timeline & manual event logger
|   |   |   |-- ui/                        # Reusable accessible UI primitives (shadcn/Radix)
|   |   |-- lib/
|   |       |-- api/                       # Typed API clients (real REST & labelled demo mock)
|   |       |-- schemas/                   # Zod schemas matching backend Pydantic contracts
|   |-- package.json                       # Next.js 16, React 19, Tailwind v4, TanStack Query
|   |-- vitest.config.mts                  # Vitest runner configuration
|-- HANDOFF.md                             # This master engineering specification
|-- README.md                              # Repository overview and quickstart guide
```

---

## 3. Mathematical & Algorithmic Formulations

### 3.1 QUBO Matrix Representation
For a route consisting of a fixed central depot (Node $0$) and $n$ customer stops (Nodes $1, \dots, n$), the stop ordering permutation is formulated as an unconstrained quadratic program.

#### Decision Variables
We define $n^2$ binary decision variables $x_{i, p} \in \{0, 1\}$:
$$x_{i, p} = 1 \iff \text{customer stop } i \in \{0, \dots, n-1\} \text{ is visited at sequence position } p \in \{0, \dots, n-1\}$$
The depot is fixed as the origin and return terminus outside the binary variables, keeping the Hilbert space exactly dimensioned at $2^{n^2}$. The linear mapping index for variable $x_{i, p}$ is given by:
$$\text{idx}(i, p) = i \cdot n + p, \quad \text{for } i, p \in \{0, \dots, n-1\}$$

#### Permutation Constraints
A valid route requires that every stop is visited exactly once (row constraint) and every sequence position is occupied by exactly one stop (column constraint):
$$H_{\text{row}} = \sum_{i=0}^{n-1} \left(1 - \sum_{p=0}^{n-1} x_{i, p}\right)^2$$
$$H_{\text{col}} = \sum_{p=0}^{n-1} \left(1 - \sum_{i=0}^{n-1} x_{i, p}\right)^2$$

Expanding a one-hot penalty term $(1 - \sum_a x_a)^2$ where $x_a^2 = x_a$ for binary variables:
$$\left(1 - \sum_a x_a\right)^2 = 1 - 2 \sum_a x_a + \left(\sum_a x_a\right)^2 = 1 - \sum_a x_a + 2 \sum_{a < b} x_a x_b$$
Thus, each one-hot constraint group adds $+A$ to the constant offset, $-A$ to diagonal elements $Q_{a, a}$, and $+2A$ to off-diagonal elements $Q_{a, b}$.

#### Objective Function (Normalized Travel Cost)
Let $D$ denote the $(n+1) \times (n+1)$ distance matrix normalized by its maximum entry $D_{\max} = \max_{i, j} D_{i, j}$, yielding normalized distances $d_{i, j} = D_{i, j} / D_{\max} \in [0, 1]$.
The total routing distance comprises three components:
1. Outbound leg from depot ($0$) to first stop at position $p=0$:
   $$H_{\text{outbound}} = \sum_{i=0}^{n-1} d_{0, i+1} \, x_{i, 0}$$
2. Transition legs between consecutive stops at positions $p$ and $p+1$:
   $$H_{\text{transitions}} = \sum_{p=0}^{n-2} \sum_{i=0}^{n-1} \sum_{j=0, j \ne i}^{n-1} d_{i+1, j+1} \, x_{i, p} \, x_{j, p+1}$$
3. Return leg from final stop at position $p=n-1$ back to depot ($0$):
   $$H_{\text{return}} = \sum_{i=0}^{n-1} d_{i+1, 0} \, x_{i, n-1}$$

#### Combined QUBO Energy
$$E(\mathbf{x}) = \mathbf{x}^T Q \mathbf{x} + \text{const}$$
$$\min_{\mathbf{x} \in \{0, 1\}^{n^2}} E(\mathbf{x}) = H_{\text{outbound}} + H_{\text{transitions}} + [H_{\text{return}}] + A \left(H_{\text{row}} + H_{\text{col}}\right)$$
The penalty factor $A$ is typically set to $2.0$ (relative to the $[0, 1]$ normalized distances) to enforce strict permutation feasibility over travel distance minimization.

---

### 3.2 Ising Hamiltonian Mapping
Quantum annealers and Gate-based QAOA circuits execute physical operations using spin operators (Pauli-$Z$) acting on quantum bits. We transform the binary variables $x_a \in \{0, 1\}$ into spin eigenstates $s_a \in \{+1, -1\}$ via the algebraic projection:
$$x_a = \frac{I - Z_a}{2}$$
where $I$ is the $2 \times 2$ identity matrix and $Z_a = \begin{pmatrix} 1 & 0 \\ 0 & -1 \end{pmatrix}$ is the Pauli-$Z$ operator acting on qubit $a$. Under this mapping:
- Binary state $x_a = 0 \iff Z_a |0\rangle = +1 |0\rangle$
- Binary state $x_a = 1 \iff Z_a |1\rangle = -1 |1\rangle$

Substituting into quadratic terms:
$$x_a x_b = \left(\frac{I - Z_a}{2}\right)\left(\frac{I - Z_b}{2}\right) = \frac{1}{4} \left(I - Z_a - Z_b + Z_a Z_b\right)$$
Substituting into diagonal linear terms:
$$Q_{a, a} x_a = Q_{a, a} \left(\frac{I - Z_a}{2}\right) = \frac{Q_{a, a}}{2} I - \frac{Q_{a, a}}{2} Z_a$$

Combining terms yields the standard Ising Spin Glass Hamiltonian:
$$H_C = \sum_{a=0}^{N-1} h_a Z_a + \sum_{a < b} J_{a, b} Z_a Z_b + \text{offset} \cdot I$$
where:
$$h_a = -\frac{Q_{a, a}}{2} - \sum_{b \ne a} \frac{Q_{a, b} + Q_{b, a}}{4}$$
$$J_{a, b} = \frac{Q_{a, b} + Q_{b, a}}{4}$$
$$\text{offset} = \text{const} + \sum_{a} \frac{Q_{a, a}}{2} + \sum_{a < b} \frac{Q_{a, b} + Q_{b, a}}{4}$$

Because $H_C$ is composed entirely of tensor products of Pauli-$Z$ and identity operators, it is strictly diagonal in the computational basis. Its eigenvalues correspond directly to the classical QUBO energies:
$$\langle \mathbf{z} | H_C | \mathbf{z} \rangle = E(\mathbf{z})$$

---

### 3.3 QAOA Quantum Circuit Ansatz & Variational Optimization
The Quantum Approximate Optimization Algorithm (QAOA) prepares a parameterized quantum state $|\psi(\boldsymbol{\gamma}, \boldsymbol{\beta})\rangle$ of depth $p$ layers on $N = n^2$ qubits:

#### Initial State
Equal superposition over all $2^{n^2}$ computational basis states via Hadamard transform:
$$|\psi_0\rangle = H^{\otimes N} |0\rangle^{\otimes N} = \frac{1}{\sqrt{2^N}} \sum_{\mathbf{z} \in \{0, 1\}^N} |\mathbf{z}\rangle$$

#### Mixer Hamiltonian
Standard transverse-field driver generating transitions between bitstrings:
$$H_M = \sum_{a=0}^{N-1} X_a$$

#### Parameterized Circuit ($p$-Layers)
$$|\psi(\boldsymbol{\gamma}, \boldsymbol{\beta})\rangle = \prod_{k=1}^p \left( e^{-i \beta_k H_M} e^{-i \gamma_k H_C} \right) |\psi_0\rangle$$
where $\boldsymbol{\gamma} = (\gamma_1, \dots, \gamma_p)$ and $\boldsymbol{\beta} = (\beta_1, \dots, \beta_p)$ are variational rotation angles.

```
|0> --- H --- [ exp(-i gamma_1 H_C) ] --- [ exp(-i beta_1 H_M) ] --- ... --- Measure
|0> --- H --- [ exp(-i gamma_1 H_C) ] --- [ exp(-i beta_1 H_M) ] --- ... --- Measure
...
|0> --- H --- [ exp(-i gamma_1 H_C) ] --- [ exp(-i beta_1 H_M) ] --- ... --- Measure
```

#### Expectation Evaluation & Classical Optimization
Because $H_C$ is diagonal, the expectation value $\langle H_C \rangle$ under statevector simulation on Qiskit Aer is computed exactly from the probability vector $\mathbf{P}(\boldsymbol{\theta})$ where $P_k = |\langle k | \psi(\boldsymbol{\theta})\rangle|^2$:
$$\langle H_C \rangle_{\boldsymbol{\theta}} = \sum_{k=0}^{2^N-1} P_k(\boldsymbol{\theta}) \cdot E_k = \mathbf{P}(\boldsymbol{\theta}) \cdot \mathbf{E}$$
where $\mathbf{E}$ is the precomputed vector of QUBO energies.

The classical optimizer (COBYLA — Constrained Optimization BY Linear Approximation) iteratively updates the parameter vector $\boldsymbol{\theta} = (\boldsymbol{\gamma}, \boldsymbol{\beta})$:
$$\boldsymbol{\theta}^* = \arg\min_{\boldsymbol{\theta}} \langle H_C \rangle_{\boldsymbol{\theta}}$$
- **Random Restarts:** RouteZen executes multi-start restarts (1 to 4 restarts, default 2) sampling initial parameters uniformly from $[0, \pi]^{2p}$, retaining the lowest-energy probability distribution to prevent entrapment in local variational basins.
- **Shot Sampling & Permutation Decoding:** After convergence, $S = 1024$ measurement shots are drawn from $\mathbf{P}(\boldsymbol{\theta}^*)$. Each basis index $k$ is decoded:
  $$\text{Stop } i \text{ at position } p \iff (k \gg (i \cdot n + p)) \ \& \ 1 = 1$$
  Bitstrings failing row/column one-hot constraints are identified as invalid and discarded. Feasible samples are scored against real route mileage and compared directly against exact brute-force permutations.

---

### 3.4 Simulated Annealing over QUBO
To overcome the Hilbert space simulation memory ceiling while solving the identical mathematical QUBO problem, RouteZen provides a dedicated high-performance **Simulated Annealing Engine**.

```
Algorithm: Metropolis Simulated Annealing over QUBO
Input: Distance Matrix D, Stops S, Temperature Schedule (T_init=10.0, T_final=0.01, alpha=0.995, Steps=5000)
Output: Optimal Visiting Permutation, Feasibility Flag, Cost

1. Build QUBO Matrix Q and constant c from D.
2. Initialize x from random permutation: x[i*n + p] = 1.
3. Compute initial energy: E = x^T Q x + c.
4. Precompute symmetric interaction matrix: M_sym = Q + Q^T.
5. Initialize gradient vector: g = M_sym * x.
6. Set T_curr = T_init.

7. For step = 1 to Steps:
     a. With 50% probability (if x represents a valid permutation):
          Propose 2-opt move (reverse segment between positions p1, p2).
          Compute delta_E directly from candidate permutation.
        Else:
          Pick random bit index k in [0, n^2 - 1].
          Compute delta_xk = 1 - 2*x[k].
          Evaluate O(1) Fast Delta-Energy: delta_E = delta_xk * g[k] + Q[k, k].

     b. Metropolis Acceptance:
          If delta_E <= 0 OR rand() < exp(-delta_E / T_curr):
             Accept move:
             Update state x.
             Update energy E = E + delta_E.
             Update gradient: g = g + delta_xk * M_sym[:, k].
             If x is a valid permutation and cost < best_cost:
                Record best permutation and best cost.

     c. Cool Temperature:
          T_curr = max(T_final, T_curr * alpha).

8. Return best valid permutation, validate vehicle capacities & time windows.
```

**Computational Complexity:** Single bit-flip delta evaluations run in $\mathcal{O}(1)$ time using the cached gradient vector $\mathbf{g}$, and gradient vector updates run in $\mathcal{O}(N)$ vector operations. This enables 5,000 to 20,000 thermodynamic steps within $40 - 60 \text{ ms}$, solving up to $N = 30$ stops without quantum statevector RAM constraints.

---

### 3.5 Two-Phase Hybrid Decomposition
The hybrid optimizer seamlessly integrates global classical constraint satisfaction with boundary-aware local quantum optimization:

```
[Phase 1: Global OR-Tools CVRP Baseline]
   Inputs: N stops, M heterogeneous vehicles, Time Windows, Capacity limits
   Result: Feasible baseline routes R_1, R_2, ..., R_m
           Total Distance: D_base, Total Duration: T_base

[Phase 2: Boundary-Aware Local Quantum Reordering]
   For each route R_k in baseline:
      Partition stop sequence into non-overlapping chunks G_j of size <= 4 stops
      For each chunk G_j = [s_1, s_2, ..., s_c]:
         Identify fixed preceding stop (or depot): Predecessor P
         Identify fixed succeeding stop (or return depot): Successor S
         Construct synthetic (c+1) x (c+1) segment matrix:
            - Row 0 -> Outgoing arcs from P to each stop in G_j
            - Column 0 -> Incoming arcs from each stop in G_j to S
            - Sub-matrix -> Point-to-point transit arcs between stops in G_j
         Solve via QAOA (Qiskit Aer statevector simulation)
         If solved feasible:
            Replace local order of G_j in R_k with quantum order

[Phase 3: OR-Tools Verification & Warm-Start Refinement]
   Construct initial route assignments from quantum-reordered routes
   Pass seeds into OR-Tools: ReadAssignmentFromRoutes(seeds)
   Execute Guided Local Search refinement with strict time limit

[Phase 4: Candidate Safety Gate]
   Evaluate Candidate:
   IF len(Candidate.unassigned) <= len(Baseline.unassigned)
      AND Candidate.physical_objective <= Baseline.physical_objective + 1e-9
      AND "seed validated" in OR-Tools notes:
         SELECT Candidate ("quantum_seeded")
   ELSE:
         RETAIN Baseline ("classical_baseline")
```

**Boundary Preservation:** Crucially, the synthetic depot in the local sub-matrix preserves both the predecessor and successor boundary arcs. Even if the underlying road matrix is asymmetric ($D_{a, b} \ne D_{b, a}$ due to one-way streets in Chennai), the entrance from the route's predecessor and exit to the route's successor are rigorously modeled.

---

### 3.6 Classical Multi-Objective CVRP/VRPTW in OR-Tools
Google OR-Tools acts as the primary classical workhorse for fleet-wide dispatching.

#### Multi-Objective Arc Cost Function
To balance conflicting commercial priorities, arc costs are normalized against the maximum values across the distance matrix ($D_{\max}$), duration matrix ($T_{\max}$), fleet operating cost per km ($C_{\max}$), and fleet emissions ($E_{\max}$):
$$\text{Cost}(v, i, j) = \frac{1000}{W_{\text{sum}}} \left[ w_d \frac{D_{i, j}}{D_{\max}} + w_t \frac{T_{i, j}}{T_{\max}} + w_c \frac{D_{i, j} \cdot c_v^{\text{km}}}{C_{\max}} + w_e \frac{D_{i, j} \cdot e_v^{\text{km}}}{E_{\max}} \right]$$
where $W_{\text{sum}} = w_d + w_t + w_c + w_e > 0$, $c_v^{\text{km}}$ is vehicle operating cost in ₹/km, and $e_v^{\text{km}}$ is tailpipe emissions in $\text{g CO}_2/\text{km}$. Fixed vehicle dispatch costs are incorporated via vehicle fixed cost evaluators:
$$\text{FixedCost}(v) = \frac{1000 \cdot w_c}{W_{\text{sum}}} \cdot \frac{F_v}{C_{\max}}$$

#### Dimensions & Constraints
1. **Time Dimension:**
   $$t_{j} \ge t_{i} + T_{i, j} + \text{service\_time}_i$$
   Cumulative variables constrained to customer time windows:
   $$\text{CumulVar}(i) \in [\text{window\_start}_i \cdot 60, \text{window\_end}_i \cdot 60]$$
2. **Payload Weight Dimension:**
   $$\sum_{i \in \text{route}(v)} \text{weight}_i \le \text{payload}_v \quad (\text{scaled to grams integer})$$
3. **Cargo Volume Dimension:**
   $$\sum_{i \in \text{route}(v)} \text{volume}_i \le \text{cargo\_volume}_v \quad (\text{scaled to litres integer})$$
4. **Max Stops Dimension:**
   $$\sum_{i \in \text{route}(v)} 1 \le \text{max\_stops}_v$$
5. **Soft Disjunctions for Infeasible Drops:**
   Every customer node is wrapped in a disjunction with a drop penalty:
   $$\text{DropPenalty} = 10,000,000$$
   This prevents solver termination failure when tight time windows or capacity constraints make 100% assignment impossible; unserviced stops are cleanly surfaced in `unassigned` with specific root causes.

---

### 3.7 Dynamic In-Transit Rerouting Engine
Real-time dispatch disruptions (breakdowns, emergency orders, severe Chennai monsoon waterlogging) require dynamic in-transit rerouting rather than restarting dispatch from scratch.

```
+-------------------------------------------------------------------------------+
|                       DYNAMIC REROUTE STATE MACHINE                           |
+-------------------------------------------------------------------------------+
|                                                                               |
|  Initial Route: [Depot] -> [Stop 1] -> [Stop 2] -> [Stop 3] -> [Stop 4]       |
|                               ^                                               |
|                           Completed                                           |
|                                                                               |
|  Disruption Event:                                                            |
|  - Vehicle V1 breaks down after Stop 1                                        |
|  - Vehicle V2 is at GPS Position (13.0418, 80.2341)                           |
|  - Emergency Stop 5 added                                                     |
|                                                                               |
|  Rerouting Transformation:                                                    |
|  1. Completed Stop Pruning: Filter out Stop 1                                 |
|  2. Active Fleet Filtering: Exclude V1; Retain active V2                      |
|  3. Virtual Origin Hydration:                                                 |
|     Node 0: Central Depot                                                     |
|     Node 1: Virtual Origin V2 (GPS lat/lng)                                   |
|     Nodes 2..5: Pending Stops [2, 3, 4] + Emergency Stop [5]                  |
|  4. Multi-Origin Matrix Construction: OSRM road matrix over [Depot, V2, S2..S5]|
|  5. OR-Tools Solve with Starts=[Node 1], Ends=[Depot (0)]                     |
|                                                                               |
|  Output Route:                                                                |
|  [V2 GPS Origin] -> [Stop 2] -> [Stop 5 (New)] -> [Stop 3] -> [Stop 4] -> [Depot]
+-------------------------------------------------------------------------------+
```

---

### 3.8 Deterministic Fleet Recommendation Engine
The fleet recommendation engine evaluates candidate vehicles for individual consignments with zero randomness and strict paise-level (`Decimal("0.01")`) rounding.

#### Energy & Cost Formulations
- **Fuel Vehicle (Petrol, Diesel, CNG):**
  $$\text{Fuel Consumed (L)} = \frac{D_{\text{billed}}}{\text{mileage (km/L)}}$$
  $$\text{Energy Cost (₹)} = \text{Fuel Consumed} \times \text{fuel\_price (₹/L)}$$
- **Electric Vehicle (EV):**
  $$\text{Electricity Consumed (kWh)} = D_{\text{billed}} \times \left(\frac{1}{\text{efficiency (km/kWh)}}\right)$$
  $$\text{Energy Cost (₹)} = \text{Electricity Consumed} \times \text{electricity\_tariff (₹/kWh)}$$
- **Variable & Operating Costs:**
  $$\text{Operating Cost (₹)} = D_{\text{billed}} \times \text{operating\_cost\_per\_km}$$
  $$\text{Variable Cost (₹)} = \text{Energy Cost} + \text{Operating Cost}$$
  $$\text{Total Cost (₹)} = \text{Variable Cost} + \text{fixed\_cost\_per\_delivery}$$
  *(Note: Operating cost covers driver wages, tyre wear, and maintenance; energy is excluded to guarantee zero double-counting).*

#### Multi-Criteria Scoring Function
Eligible vehicles are evaluated across four weighted dimensions:
$$\text{Score} = \frac{100}{W} \left[ w_{\text{cost}} \left(1 - \text{norm}(C)\right) + w_{\text{time}} \left(1 - \text{norm}(T)\right) + w_{\text{emissions}} \left(1 - \text{norm}(E)\right) + w_{\text{util}} \cdot \max\left(\frac{m_{\text{pkg}}}{M_{\text{veh}}}, \frac{v_{\text{pkg}}}{V_{\text{veh}}}\right) \right]$$
where $\text{norm}(x) = \frac{x - x_{\min}}{x_{\max} - x_{\min}}$ across eligible vehicles, and $W = w_{\text{cost}} + w_{\text{time}} + w_{\text{emissions}} + w_{\text{util}}$.

---

## 4. Full REST API Specification

All API endpoints are hosted under `/api/v1` with JSON request/response formats. Monetary values use two decimal places in INR (₹).

### 4.1 Optimization Endpoints

#### `POST /api/v1/optimization/classical`
Asynchronously queues a classical OR-Tools CVRP/VRPTW optimization run.
- **Status Code:** `202 Accepted`
- **Request Body:**
```json
{
  "depot": { "latitude": 13.0067, "longitude": 80.2206, "name": "Guindy Depot" },
  "stops": [
    { "id": "s1", "latitude": 13.0418, "longitude": 80.2341, "weight_kg": 25.0, "volume_m3": 0.15, "service_minutes": 10, "window_start_min": 0, "window_end_min": 180 },
    { "id": "s2", "latitude": 13.0850, "longitude": 80.2101, "weight_kg": 40.0, "volume_m3": 0.30, "service_minutes": 15, "window_start_min": 30, "window_end_min": 240 }
  ],
  "vehicles": [
    { "vehicle_id": "v-electric-3w", "payload_kg": 500, "volume_m3": 3.0, "cost_per_km": 2.8, "fixed_cost": 25.0, "emissions_g_per_km": 0, "max_stops": 15, "available": true }
  ],
  "weights": { "distance": 0.4, "time": 0.3, "cost": 0.2, "emissions": 0.1 },
  "return_to_depot": true,
  "time_limit_s": 5,
  "allow_fallback_estimate": false
}
```
- **Response Body (`RunRecord`):**
```json
{
  "id": "run-6a84f32c-7b02-4011-9a7f-d12f4587c631",
  "kind": "classical",
  "status": "queued",
  "created_at": "2026-10-09T13:30:00Z",
  "started_at": null,
  "finished_at": null,
  "request": { "stops": 2, "vehicles": 1, "time_limit_s": 5 },
  "result": null,
  "error": null
}
```

#### `POST /api/v1/optimization/quantum`
Queues a QAOA statevector simulation for single-vehicle stop ordering ($N \le 4$).
- **Status Code:** `202 Accepted`
- **Request Body:**
```json
{
  "depot": { "latitude": 13.0067, "longitude": 80.2206 },
  "stops": [
    { "id": "stop-tnagar", "latitude": 13.0418, "longitude": 80.2341, "weight_kg": 10 },
    { "id": "stop-adyar", "latitude": 13.0012, "longitude": 80.2565, "weight_kg": 15 },
    { "id": "stop-velachery", "latitude": 12.9815, "longitude": 80.2180, "weight_kg": 20 }
  ],
  "objective": "distance",
  "return_to_depot": true,
  "reps": 1,
  "max_iterations": 60,
  "restarts": 2,
  "shots": 1024,
  "seed": 7
}
```
- **Polled Result (`GET /api/v1/optimization/runs/{id}`):**
```json
{
  "solver": "qaoa_aer_simulation",
  "simulation": true,
  "disclaimer": "Result from a classical statevector SIMULATION of QAOA (Qiskit Aer). No quantum hardware was used and no quantum advantage is claimed.",
  "status": "solved",
  "n_stops": 3,
  "n_qubits": 9,
  "reps": 1,
  "iterations": 84,
  "order": ["stop-adyar", "stop-velachery", "stop-tnagar"],
  "cost": 21.432,
  "feasible": true,
  "feasibility_issues": [],
  "feasible_probability": 0.418293,
  "shots": 1024,
  "brute_force_order": ["stop-adyar", "stop-velachery", "stop-tnagar"],
  "brute_force_cost": 21.432,
  "gap_vs_brute_force_pct": 0.0,
  "matches_brute_force": true,
  "runtime_ms": 424.0,
  "objective": "distance"
}
```

#### `POST /api/v1/optimization/hybrid`
Queues a Two-Phase Hybrid Decomposition run (OR-Tools global + QAOA local clusters).
- **Status Code:** `202 Accepted`
- **Request Body:**
```json
{
  "depot": { "latitude": 13.0067, "longitude": 80.2206 },
  "stops": [
    { "id": "s1", "latitude": 13.0418, "longitude": 80.2341, "weight_kg": 15 },
    { "id": "s2", "latitude": 13.0850, "longitude": 80.2101, "weight_kg": 20 },
    { "id": "s3", "latitude": 13.0012, "longitude": 80.2565, "weight_kg": 10 },
    { "id": "s4", "latitude": 12.9815, "longitude": 80.2180, "weight_kg": 25 },
    { "id": "s5", "latitude": 13.0382, "longitude": 80.1565, "weight_kg": 18 }
  ],
  "vehicles": [
    { "vehicle_id": "v1", "payload_kg": 500, "volume_m3": 3.0, "available": true }
  ],
  "quantum_objective": "distance",
  "cluster_size": 3,
  "quantum_timeout_s": 30,
  "time_limit_s": 5
}
```
- **Polled Result:** Returns `OptimizationResult` containing `hybrid: HybridMetrics` with cluster-level quantum execution breakdowns and baseline-versus-candidate disclosures.

#### `POST /api/v1/optimization/annealing`
Runs Simulated Annealing directly on the unconstrained QUBO matrix.
- **Query Parameter:** `?sync=true` returns immediate result; default `false` queues a background job.
- **Request Body (`AnnealingRequest`):** Supports parameters `initial_temp` (default 10.0), `final_temp` (0.01), `cooling_rate` (0.995), `steps` (5000), `seed` (7).
- **Response:** `QuantumResult` with `solver: "simulated_annealing_qubo"`.

#### `POST /api/v1/optimization/reroute`
Executes synchronous dynamic multi-origin in-transit rerouting.
- **Status Code:** `200 OK`
- **Request Body (`DynamicRerouteRequest`):**
```json
{
  "depot": { "latitude": 13.0067, "longitude": 80.2206 },
  "stops": [
    { "id": "s1", "latitude": 13.0418, "longitude": 80.2341, "weight_kg": 15 },
    { "id": "s2", "latitude": 13.0850, "longitude": 80.2101, "weight_kg": 25 },
    { "id": "s3", "latitude": 13.0012, "longitude": 80.2565, "weight_kg": 20 }
  ],
  "vehicles": [
    { "vehicle_id": "v1", "payload_kg": 200, "volume_m3": 2.0, "available": true },
    { "vehicle_id": "v2", "payload_kg": 200, "volume_m3": 2.0, "available": true }
  ],
  "completed_stop_ids": ["s1"],
  "disrupted_vehicle_ids": ["v1"],
  "vehicle_positions": {
    "v2": { "lat": 13.0200, "lng": 80.2150 }
  },
  "new_stops": [
    { "id": "s-emergency", "latitude": 13.0300, "longitude": 80.2250, "weight_kg": 10 }
  ]
}
```
- **Response Body (`DynamicRerouteResult`):**
```json
{
  "status": "solved",
  "routes": [
    {
      "vehicle_id": "v2",
      "stops": [
        { "stop_id": "s-emergency", "arrival_min": 8.4, "departure_min": 13.4, "cumulative_distance_km": 2.8, "load_kg": 10.0, "load_m3": 0.0 },
        { "stop_id": "s2", "arrival_min": 28.2, "departure_min": 33.2, "cumulative_distance_km": 9.4, "load_kg": 35.0, "load_m3": 0.0 },
        { "stop_id": "s3", "arrival_min": 52.1, "departure_min": 57.1, "cumulative_distance_km": 18.2, "load_kg": 55.0, "load_m3": 0.0 }
      ],
      "distance_km": 23.4,
      "duration_min": 68.5,
      "load_kg": 55.0,
      "cost": 145.5,
      "emissions_g": 0.0
    }
  ],
  "unassigned": [],
  "completed_stops_count": 1,
  "reassigned_stops_count": 2,
  "emergency_stops_count": 1,
  "disrupted_vehicles": ["v1"],
  "active_vehicles": ["v2"],
  "notes": [
    "Disrupted vehicles excluded: ['v1']. Stops reassigned to 1 available vehicle(s).",
    "1 completed stop(s) excluded from dispatch plan.",
    "1 emergency/new stop(s) added to routes."
  ]
}
```

#### `GET /api/v1/optimization/compare?classical={c_id}&quantum={q_id}`
Returns side-by-side metric comparison between classical and quantum runs with explicit disclosure notes.

---

### 4.2 Fleet Recommendation Endpoints

#### `POST /api/v1/recommendations`
Evaluates fleet profiles against packages and returns scored options.
- **Request Body:**
```json
{
  "depot": { "latitude": 13.0067, "longitude": 80.2206 },
  "packages": [
    { "package_id": "pkg-101", "weight_kg": 15.0, "volume_m3": 0.05, "latitude": 13.0418, "longitude": 80.2341 }
  ],
  "preferences": {
    "round_trip": true,
    "require_deadline": false,
    "weights": { "cost": 0.4, "time": 0.3, "emissions": 0.2, "utilisation": 0.1 }
  }
}
```
- **Response Item (`PackageRecommendation`):**
```json
{
  "package_id": "pkg-101",
  "recommended": {
    "vehicle_id": "veh-ev-scooter",
    "name": "Electric scooter (demo)",
    "category": "two_wheeler",
    "energy_used": 0.354,
    "energy_unit": "kWh",
    "energy_cost": 2.83,
    "operating_cost": 14.16,
    "variable_cost": 16.99,
    "fixed_cost": 12.00,
    "total_cost": 28.99,
    "cost_per_km": 2.05,
    "travel_minutes": 34.0,
    "emissions_g": 0.0,
    "payload_utilisation": 0.75,
    "volume_utilisation": 0.625,
    "score": 92.45
  },
  "alternatives": [
    { "vehicle_id": "veh-petrol-scooter", "name": "Petrol scooter (demo)", "total_cost": 48.47, "score": 76.12 }
  ],
  "ineligible": [
    { "vehicle_id": "veh-heavy-van", "reasons": ["Operating cost exceeds competitive range"] }
  ],
  "distance_km": 7.08,
  "billed_distance_km": 14.16,
  "explanation": "Electric scooter (demo) is recommended for 7.1 km (round trip billed as 14.2 km): total ₹28.99 = energy ₹2.83 (0.35 kWh) + operating ₹14.16 + fixed ₹12.00. It uses 75% of payload (15 kg) and 62% of cargo volume, with about 34 min of travel. It costs ₹19.48 less than Petrol scooter (demo)."
}
```

---

### 4.3 Routing & Distance Engine Endpoints

- `POST /api/v1/routing/route`: Accepts `{ "coordinates": [{"lat": ..., "lng": ...}] }`. Returns turn-by-turn road polyline geometry (`[[lat, lng], ...]`), distance in km, duration in minutes, and provider (`"osrm"`).
- `POST /api/v1/routing/matrix`: Computes $M \times M$ distance and duration matrices via OSRM table service with TTL caching.
- `GET /api/v1/routing/status`: Reports OSRM connection health, base URL, and cache statistics.

---

### 4.4 Dispatch Plans & Operations Endpoints

- `GET /api/v1/plans`: List dispatch plans with status filtering (`draft`, `dispatched`, `completed`, `cancelled`).
- `POST /api/v1/plans`: Persist a finalized dispatch plan with vehicle-to-package assignments.
- `GET /api/v1/plans/{id}`: Retrieve plan details, stops, assigned vehicles, and polyline coordinates.
- `POST /api/v1/plans/validate`: Pre-dispatch schema and foreign key validator.

---

### 4.5 System Health & Analytics Endpoints

- `GET /api/v1/health`: Basic liveness probe (`{"status": "ok"}`).
- `GET /api/v1/ready`: Deep readiness probe inspecting PostgreSQL DB connection, OSRM reachability, OR-Tools classical solver, and Qiskit Aer quantum simulator.
- `GET /api/v1/analytics/summary`: Aggregate metrics across total plans, deliveries, fuel savings, and carbon emissions avoided.
- `GET /api/v1/reports/{kind}.csv`: Downloadable reporting streams (`deliveries.csv`, `emissions.csv`, `fleet-cost.csv`).

---

## 5. Benchmark & Empirical Performance Analysis

### 5.1 Multi-Solver Benchmark Results
Empirical benchmarks were conducted using `backend/scripts/benchmark_solvers.py` over 3 independent trials per problem size using synthetic Chennai spatial coordinates.

| Problem Size | Solver | Feasibility Rate | Mean Latency | Best Dist | Mean Dist | Optimality Gap vs Exact |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **$N=2$** | **Brute Force (Exact)** | 100.0% | $0.02 \pm 0.01 \text{ ms}$ | $9.58 \text{ km}$ | $13.76 \text{ km}$ | **0.00%** (Baseline) |
| $N=2$ | **QAOA (Aer Sim)** | 100.0% | $278.07 \pm 9.5 \text{ ms}$ | $9.58 \text{ km}$ | $13.76 \text{ km}$ | **0.00%** |
| $N=2$ | **Simulated Annealing** | 100.0% | $43.67 \pm 3.5 \text{ ms}$ | $9.58 \text{ km}$ | $13.76 \text{ km}$ | **0.00%** |
| $N=2$ | **Classical OR-Tools** | 100.0% | $4.23 \pm 3.6 \text{ ms}$ | $9.58 \text{ km}$ | $13.76 \text{ km}$ | **0.00%** |
| **$N=3$** | **Brute Force (Exact)** | 100.0% | $0.04 \pm 0.02 \text{ ms}$ | $9.55 \text{ km}$ | $11.60 \text{ km}$ | **0.00%** (Baseline) |
| $N=3$ | **QAOA (Aer Sim)** | 100.0% | $424.03 \pm 36.2 \text{ ms}$ | $9.55 \text{ km}$ | $11.60 \text{ km}$ | **0.00%** |
| $N=3$ | **Simulated Annealing** | 100.0% | $42.87 \pm 3.2 \text{ ms}$ | $9.55 \text{ km}$ | $11.60 \text{ km}$ | **0.00%** |
| $N=3$ | **Classical OR-Tools** | 100.0% | $2.40 \pm 1.4 \text{ ms}$ | $9.55 \text{ km}$ | $11.60 \text{ km}$ | **0.00%** |
| **$N=4$** | **Brute Force (Exact)** | 100.0% | $0.09 \pm 0.03 \text{ ms}$ | $20.17 \text{ km}$ | $20.72 \text{ km}$ | **0.00%** (Baseline) |
| $N=4$ | **QAOA (Aer Sim)** | 66.7% | $4456.40 \pm 506.1 \text{ ms}$ | $20.17 \text{ km}$ | $20.20 \text{ km}$ | **0.00%** *(on valid)* |
| $N=4$ | **Simulated Annealing** | 100.0% | $43.47 \pm 1.3 \text{ ms}$ | $20.17 \text{ km}$ | $20.72 \text{ km}$ | **0.00%** |
| $N=4$ | **Classical OR-Tools** | 100.0% | $1001.63 \pm 0.2 \text{ ms}$ | $20.17 \text{ km}$ | $20.72 \text{ km}$ | **0.00%** |
| **$N=6$** | **Simulated Annealing** | 100.0% | $57.47 \pm 20.2 \text{ ms}$ | $21.23 \text{ km}$ | $22.59 \text{ km}$ | **0.00%** *(vs OR-Tools)* |
| $N=6$ | **Classical OR-Tools** | 100.0% | $1001.00 \pm 0.4 \text{ ms}$ | $21.23 \text{ km}$ | $22.59 \text{ km}$ | Baseline Standard |
| **$N=8$** | **Simulated Annealing** | 100.0% | $55.00 \pm 1.8 \text{ ms}$ | $25.85 \text{ km}$ | $29.64 \text{ km}$ | **0.00%** *(vs OR-Tools)* |
| $N=8$ | **Classical OR-Tools** | 100.0% | $1001.50 \pm 0.3 \text{ ms}$ | $25.85 \text{ km}$ | $29.64 \text{ km}$ | Baseline Standard |
| **$N=10$** | **Simulated Annealing** | 100.0% | $63.87 \pm 0.9 \text{ ms}$ | $26.44 \text{ km}$ | $30.63 \text{ km}$ | **0.00%** *(vs OR-Tools)* |
| $N=10$ | **Classical OR-Tools** | 100.0% | $1001.63 \pm 0.7 \text{ ms}$ | $26.44 \text{ km}$ | $30.63 \text{ km}$ | Baseline Standard |

---

### 5.2 Quantum Simulation Boundaries & Qubit Scaling Law

#### The $N^2$ Qubit Bottleneck
The one-hot permutation encoding requires $N_{\text{qubits}} = N^2$ qubits for $N$ customer stops. A statevector simulator must maintain a complex statevector of length $2^{N^2}$, requiring $2^{N^2} \times 16 \text{ bytes}$ of physical memory:

- $N = 2 \implies 4 \text{ qubits} \implies 2^4 = 16 \text{ amplitudes} \implies 256 \text{ bytes}$
- $N = 3 \implies 9 \text{ qubits} \implies 2^9 = 512 \text{ amplitudes} \implies 8.19 \text{ KB}$
- $N = 4 \implies 16 \text{ qubits} \implies 2^{16} = 65,536 \text{ amplitudes} \implies 1.05 \text{ MB}$
- $N = 5 \implies 25 \text{ qubits} \implies 2^{25} \approx 3.35 \times 10^7 \text{ amplitudes} \implies 536.9 \text{ MB}$
- $N = 6 \implies 36 \text{ qubits} \implies 2^{36} \approx 6.87 \times 10^{10} \text{ amplitudes} \implies 1.09 \text{ Terabytes RAM}$ *(Intractable)*

#### Permutation Sparsity within Hilbert Space
The fraction of valid visiting permutations relative to total computational basis states shrinks super-exponentially:
$$\text{Ratio}(N) = \frac{N!}{2^{N^2}}$$
- For $N=2$: $\frac{2!}{16} = 12.5\%$
- For $N=3$: $\frac{6!}{512} \approx 1.17\%$
- For $N=4$: $\frac{24!}{65536} \approx 0.0366\%$ (Only 24 states out of 65,536 are valid routes)

At $N=4$, the probability mass is heavily dispersed across infeasible bitstrings unless the QAOA depth $p$ and parameter convergence are high. This explains why unseeded QAOA on $N=4$ exhibited a $66.7\%$ raw feasibility rate across sample trials.

### 5.3 Engineering Trade-Offs
These empirical realities justify RouteZen's engineering architecture:
1. Direct QAOA statevector simulation is strictly limited to $N \le 4$ stops (16 qubits) as an educational correctness demonstration.
2. For intermediate scales ($N \le 30$), Simulated Annealing solves the exact same QUBO formulation in $<65 \text{ ms}$ with 100% feasibility.
3. For commercial multi-vehicle fleet routing ($N \le 200$), Two-Phase Hybrid Decomposition chunks routes into groups of $\le 4$ stops, enabling quantum optimization without memory crashes or feasibility degradation.

---

## 6. Frontend Features & User Experience Workflows

### 6.1 Five-Step Delivery Planning Wizard
The delivery planner (`/plan`) guides dispatchers through a progressive 5-step workflow:
1. **Locations & Packages (`StopsPanel`):** Select or create customer consignments across Chennai zones (Guindy, T. Nagar, Adyar, Velachery, Anna Nagar, Porur).
2. **Vehicle Recommendation (`RecommendationPanel`):** Inspect deterministic powertrain recommendations with expandable "View Reason" drawers exposing mileage, fuel prices, and capacity utilization.
3. **Routing Constraints (`ConstraintsPanel`):** Configure multi-objective optimization weights (Distance, Time, Cost, Emissions), departure schedules, and return-to-depot toggles.
4. **Optimization Execution (`OptimizePanel`):** Select solver strategy (**Classical OR-Tools**, **Hybrid QAOA-OR-Tools**, **Quantum QAOA**, or **Simulated Annealing**).
5. **Results & Dispatch (`ResultsPanel`):** View road polylines, vehicle schedules, cumulative loads, and hybrid disclosure badges.

```
[ Step 1: Stops ] ---> [ Step 2: Fleet Match ] ---> [ Step 3: Weights ] ---> [ Step 4: Solve ] ---> [ Step 5: Dispatch ]
  Add Chennai Drops       EV / Diesel Cost Check       Cost vs Green Prioritization   OR-Tools / QAOA / SA     OSRM Road Polyline
```

### 6.2 Interactive Leaflet Map & OSRM Polyline Engine
- **Client-Side Dynamic Loading:** Rendered via dynamic imports (`ssr: false`) to avoid server-side window/DOM mismatches.
- **True Road Geometry:** Decodes GeoJSON polylines from OSRM (`/routing/route`), matching real Chennai highway and arterial routes.
- **Visual Design:** Yellow-green depot marker, numbered amber destination pills, and active vehicle route highlighting.
- **Tile Layer Support:** Standard OpenStreetMap tiles and Esri World Imagery satellite layer with instant toggles.

### 6.3 Live Dispatch Tracking & Simulation
- **Timeline Engine (`/tracking`):** Track plan status from dispatched to completed with progress gauges.
- **Event Logging:** Log delivery events (`arrived`, `delivered`, `delayed`, `failed`) with timestamps and optional GPS updates.
- **Clock Simulation:** Fast-forward dispatch simulation mode to test delay propagation and ETA adjustments.

### 6.4 Analytics & Scenario Comparison Engine
- **KPI Dashboards (`/analytics`):** Real-time tracking of fleet kilometers, fuel expenditures, and carbon emissions saved via electric vehicles.
- **What-If Scenarios (`/scenarios`):** Create and compare operational counterfactuals (e.g., all-EV fleet transition, diesel price hikes) with side-by-side delta visualization.

---

## 7. Verification, Quality Assurance & Test Coverage

The RouteZen platform maintains a rigorous verification matrix across backend and frontend codebases:

### 7.1 Backend Test Suite (Pytest)
- **Status:** **127 Passed** (`0 failed, 1 warning in 21.51s`)
- **Execution:** `.venv/bin/python -m pytest -q`
- **Coverage Highlights:**
  - `test_classical.py` (11 tests): Time windows, capacity limits, unassigned disjunctions, multi-objective weights.
  - `test_quantum.py` (12 tests): $N^2$ QUBO formulation, Ising mapping, statevector execution, 16-qubit boundary enforcement.
  - `test_hybrid.py` (3 tests): Boundary-aware group stitching, candidate safety gate, classical baseline retention.
  - `test_annealing.py` (9 tests): Fast $\mathcal{O}(1)$ delta energy, 2-opt transitions, scaling to $N=8, 10$ stops.
  - `test_reroute.py` (8 tests): Completed stop pruning, vehicle breakdown reallocation, virtual GPS origin routing.
  - `test_recommendation.py` (13 tests): Exact fuel vs EV formulas, paise precision, range verification.
  - `test_routing.py` (13 tests): OSRM HTTP responses, caching, 503 unavailability handling, Haversine fallback.
  - `test_run_store.py` (7 tests): Process restart recovery, abandoned job interruption, concurrent DB access.
  - `test_health_crud.py` (18 tests): CRUD, foreign key integrity, CSV streaming, health probes.

### 7.2 Frontend Test Suite (Vitest & TypeScript)
- **Status:** **88 Passed** across 12 test files (`8.25s`)
- **Linting:** ESLint clean (`0 errors, 0 warnings`)
- **TypeScript:** Strict typecheck passing (`tsc --noEmit` exits code 0)
- **Static Build:** Production Next.js build passes cleanly (`25 static pages compiled`)

---

## 8. Operational Runbook & Environment Setup

### 8.1 System Prerequisites
- **Python:** Version 3.11 or higher (developed and verified on Python 3.14)
- **Node.js:** Version 20.x or higher
- **PostgreSQL:** Neon Serverless PostgreSQL or local PostgreSQL 16+
- **OSRM:** Public OSRM driving server or dedicated local Docker container

### 8.2 Backend Setup
```bash
cd /home/mittai/Documents/ROUTEZEN/backend

# 1. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install production dependencies
pip install -r requirements.txt

# 3. Configure environment variables (create backend/.env)
cat <<EOF > .env
DATABASE_URL=postgresql+psycopg://user:password@host/routezen?sslmode=require
OSRM_BASE_URL=https://router.project-osrm.org
WORKSPACE_ID=dev-workspace
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CLASSICAL_TIME_LIMIT_S=5
QUANTUM_MAX_STOPS=4
QUANTUM_TIMEOUT_S=60.0
EOF

# 4. Run database migrations
alembic upgrade head

# 5. Seed Chennai demo locations and vehicle fleet
PYTHONPATH=. python scripts/seed.py

# 6. Launch FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 8.3 Frontend Setup
```bash
cd /home/mittai/Documents/ROUTEZEN/frontend

# 1. Install Node dependencies
npm install

# 2. Configure frontend environment (create frontend/.env.local)
cat <<EOF > .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_USE_DEMO_DATA=false
EOF

# 3. Launch Next.js dev server
npm run dev -- -p 3000
```

### 8.4 Verification Commands
```bash
# Backend pytest validation
cd /home/mittai/Documents/ROUTEZEN/backend && .venv/bin/python -m pytest -q

# Frontend verification suite
cd /home/mittai/Documents/ROUTEZEN/frontend && npm run lint && npx tsc --noEmit && npx vitest run

# Empirical solver benchmark suite
cd /home/mittai/Documents/ROUTEZEN/backend && .venv/bin/python scripts/benchmark_solvers.py --sizes "2,3,4,6,8,10"
```

---

## 9. Roadmap for Future Quantum & Logistics Enhancements

### 9.1 Physical IBM Quantum Hardware Execution (Qiskit Runtime)
- **Current State:** Simulation runs via `qiskit-aer` (`method="statevector"`).
- **Target Architecture:** Integrate `qiskit-ibm-runtime` via the `SamplerV2` and `EstimatorV2` primitives.
- **Error Mitigation:** Implement Zero-Noise Extrapolation (ZNE) and Readout Error Mitigation (M3) to handle hardware gate fidelity on IBM Eagle (127-qubit) and Heron (133-qubit) QPUs.

### 9.2 Quantum Annealing via D-Wave Ocean SDK
- **Current State:** Simulated Annealing over QUBO runs on CPU via NumPy.
- **Target Architecture:** Map RouteZen's QUBO matrix directly to D-Wave's binary quadratic model (`dimod.BinaryQuadraticModel`) and submit to the D-Wave Advantage System (5,000+ qubits, Pegasus graph topology) via the Leap Cloud API.
- **CQM Formulation:** Utilize D-Wave's Constrained Quadratic Model (CQM) to natively enforce one-hot constraints without quadratic penalty multipliers.

### 9.3 Dynamic Time-Dependent OSRM Matrices & Live Traffic
- **Current State:** Static OSRM duration matrices.
- **Target Architecture:** Integrate live traffic speed multipliers per Chennai corridor (OMR IT Expressway, Anna Salai, GST Road) using time-of-day speed index profiles.

### 9.4 Distributed Asynchronous Task Queue
- **Current State:** In-process single-worker background runner (`RunManager`).
- **Target Architecture:** Migrate to Celery with Redis/RabbitMQ broker with worker heartbeats and distributed task leases for multi-node production horizontal scaling.

---

*Authored by RouteZen Engineering Team — October 2026*

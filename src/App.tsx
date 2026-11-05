"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { concepts } from "./data/content";
import {
  calculateFinancials,
  calculateLoan,
  currency,
  irr,
  npv,
  payback,
  percent,
  type FinancialData,
  type LoanInput,
  type ProjectInput,
} from "./lib/finance";
import { Button, Field, Heading, Icon, Input, Select } from "./components/ui";
import {
  importFinancialDocument,
  type DocumentImportResult,
} from "./lib/documentImport";
import ib1Logo from "./assets/ib1-logo.jpg";
import GPRDashboard from "./components/GPRDashboard";
import SentimentDashboard from "./components/SentimentDashboard";
import MarketDashboard from "./components/MarketDashboard";

type Section =
  | "dashboard"
  | "datos"
  | "diagnostico"
  | "financiamiento"
  | "proyectos"
  | "escenarios"
  | "graficos"
  | "informes"
  | "biblioteca"
  | "historial"
  | "configuracion";

type SavedAnalysis = {
  id: number;
  name: string;
  company: string;
  date: string;
  type: string;
  period: string;
  result: number;
};

const navigation: { id: Section; label: string; icon: string }[] = [
  { id: "dashboard", label: "Inicio", icon: "dashboard" },
  { id: "datos", label: "GPR Index", icon: "chart" },
  { id: "diagnostico", label: "Sentiment Analysis", icon: "card" },
  { id: "financiamiento", label: "Financiamiento", icon: "card" },
  { id: "proyectos", label: "Proyectos de inversión", icon: "project" },
  { id: "escenarios", label: "Simulador de escenarios", icon: "sliders" },
  { id: "graficos", label: "Crear gráficos", icon: "pie" },
  { id: "informes", label: "Informes financieros", icon: "report" },
  { id: "biblioteca", label: "Biblioteca", icon: "book" },
  { id: "historial", label: "Historial", icon: "history" },
  { id: "configuracion", label: "Configuración", icon: "settings" },
];

const demoFinancials: FinancialData = {
  currentAssets: 8500000,
  nonCurrentAssets: 12500000,
  currentLiabilities: 5200000,
  nonCurrentLiabilities: 4800000,
  revenue: 24500000,
  costs: 13200000,
  operatingExpenses: 6200000,
  interest: 1250000,
  taxes: 770000,
  openingEquity: 8000000,
  contributions: 500000,
  distributions: 580000,
  openingCash: 1200000,
  operatingCashFlow: 3600000,
  investingCashFlow: -2000000,
  financingCashFlow: -700000,
};

const emptyFinancials: FinancialData = {
  currentAssets: 0,
  nonCurrentAssets: 0,
  currentLiabilities: 0,
  nonCurrentLiabilities: 0,
  revenue: 0,
  costs: 0,
  operatingExpenses: 0,
  interest: 0,
  taxes: 0,
  openingEquity: 0,
  contributions: 0,
  distributions: 0,
  openingCash: 0,
  operatingCashFlow: 0,
  investingCashFlow: 0,
  financingCashFlow: 0,
};

const initialLoans: LoanInput[] = [
  {
    name: "Banco Nación",
    amount: 6000000,
    annualRate: 62,
    months: 24,
    fees: 190000,
  },
  {
    name: "Banco Santander Río",
    amount: 6000000,
    annualRate: 55,
    months: 18,
    fees: 360000,
  },
];

const initialProjects: ProjectInput[] = [
  {
    name: "Ampliación comercial",
    initialInvestment: 5000000,
    discountRate: 22,
    flows: [1800000, 2200000, 2600000, 2800000],
    residualValue: 500000,
  },
  {
    name: "Nueva línea productiva",
    initialInvestment: 7500000,
    discountRate: 22,
    flows: [1600000, 2800000, 3500000, 4200000],
    residualValue: 900000,
  },
];

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <Heading level={1}>{title}</Heading>
        <p>{description}</p>
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}

function DemoBanner() {
  return (
    <div className="demo-banner" role="status">
      <Icon name="info" />
      <div>
        <strong>Ejemplo ficticio</strong>
        <span>
          Estos datos sirven para explorar la plataforma. No representan a una
          empresa real.
        </span>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  progress,
  progressLabel,
  tone = "blue",
}: {
  label: string;
  value: string;
  detail: string;
  progress: number;
  progressLabel: string;
  tone?: "blue" | "green" | "orange" | "violet";
}) {
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-dot" />
      </div>
      <div className="metric-visual">
        <div>
          <strong>{value}</strong>
          <small>{detail}</small>
          <span className="progress-label">{progressLabel}</span>
        </div>
        <div className="progress-ring" aria-label={progressLabel}>
          <svg viewBox="0 0 42 42">
            <circle className="ring-track" cx="21" cy="21" fill="none" pathLength="100" r="16" />
            <circle
              className="ring-value"
              cx="21"
              cy="21"
              fill="none"
              pathLength="100"
              r="16"
              strokeDasharray={`${normalizedProgress} ${100 - normalizedProgress}`}
            />
          </svg>
          <span>{Math.round(normalizedProgress)}%</span>
        </div>
      </div>
    </article>
  );
}

function LineChart({
  series,
  labels,
  title,
}: {
  series: { name: string; values: number[]; color: string }[];
  labels: string[];
  title: string;
}) {
  const all = series.flatMap((item) => item.values);
  const max = Math.max(...all, 1);
  const points = (values: number[]) =>
    values
      .map((value, index) => {
        const x = 12 + (index * 76) / Math.max(values.length - 1, 1);
        const y = 84 - (value / max) * 68;
        return `${x},${y}`;
      })
      .join(" ");
  return (
    <section className="card chart-card">
      <div className="card-heading">
        <div>
          <Heading level={3}>{title}</Heading>
          <p>Importes expresados en millones de $ ARS</p>
        </div>
        <div className="legend">
          {series.map((item) => (
            <span key={item.name}>
              <i className={`legend-dot legend-${item.color}`} />
              {item.name}
            </span>
          ))}
        </div>
      </div>
      <svg
        aria-label={title}
        className="line-chart"
        role="img"
        viewBox="0 0 100 100"
      >
        {[20, 40, 60, 80].map((y) => (
          <line className="grid-line" key={y} x1="8" x2="94" y1={y} y2={y} />
        ))}
        {series.map((item) => (
          <polyline
            className={`chart-line line-${item.color}`}
            key={item.name}
            points={points(item.values)}
          />
        ))}
      </svg>
      <div className="chart-labels">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </section>
  );
}

function ComparisonBars({
  items,
  title,
}: {
  items: { label: string; value: number; tone: string }[];
  title: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <section className="card">
      <div className="card-heading">
        <div>
          <Heading level={3}>{title}</Heading>
          <p>Comparación en $ ARS</p>
        </div>
      </div>
      <div className="bar-chart">
        {items.map((item) => (
          <div className="bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="bar-track">
              <i
                className={`bar-fill fill-${item.tone}`}
                style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
              />
            </div>
            <strong>{currency(item.value)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function CashFlowChart({ data }: { data: FinancialData }) {
  const factors = [0.72, 0.8, 0.86, 0.91, 0.95, 1];
  const monthlyRevenue = data.revenue / 6;
  const monthlyOutflow =
    (data.costs + data.operatingExpenses + data.interest + data.taxes) / 6;
  const series = factors.map((factor, index) => {
    const income = monthlyRevenue * factor;
    const expense = monthlyOutflow * (0.82 + index * 0.036);
    return { income, expense, net: income - expense };
  });
  const max = Math.max(...series.flatMap((item) => [item.income, item.expense, item.net]), 1);
  return (
    <section className="card cashflow-card">
      <div className="card-heading">
        <div>
          <Heading level={3}>Flujo de caja proyectado</Heading>
          <p>Promedio mensual estimado en $ ARS</p>
        </div>
      </div>
      <div className="column-chart" aria-label="Ingresos, egresos y flujo neto por mes" role="img">
        {series.map((item, index) => (
          <div className="column-group" key={index}>
            <div className="columns">
              <i className="column income" style={{ height: `${(item.income / max) * 100}%` }} />
              <i className="column expense" style={{ height: `${(item.expense / max) * 100}%` }} />
              <i className="column net" style={{ height: `${Math.max((item.net / max) * 100, 3)}%` }} />
            </div>
            <span>{["Ene", "Feb", "Mar", "Abr", "May", "Jun"][index]}</span>
          </div>
        ))}
      </div>
      <div className="chart-footer-legend">
        <span><i className="legend-dot legend-blue" />Ingresos</span>
        <span><i className="legend-dot legend-orange" />Egresos</span>
        <span><i className="legend-dot legend-green" />Flujo neto</span>
      </div>
    </section>
  );
}

function DonutBreakdown({
  data,
  result,
}: {
  data: FinancialData;
  result: ReturnType<typeof calculateFinancials>;
}) {
  const rawItems = [
    { label: "Capital propio", value: Math.max(result.equity, 0), tone: "blue" },
    { label: "Deuda de corto plazo", value: data.currentLiabilities, tone: "orange" },
    { label: "Deuda de largo plazo", value: data.nonCurrentLiabilities, tone: "green" },
  ];
  const total = rawItems.reduce((sum, item) => sum + item.value, 0) || 1;
  let offset = 0;
  const items = rawItems.map((item) => {
    const share = (item.value / total) * 100;
    const segment = { ...item, share, offset };
    offset -= share;
    return segment;
  });

  return (
    <section className="card breakdown-card">
      <div className="card-heading">
        <div>
          <Heading level={3}>Estructura de financiamiento</Heading>
          <p>Origen de los fondos del período</p>
        </div>
      </div>
      <div className="donut-layout">
        <div className="donut-chart">
          <svg aria-label="Estructura porcentual de financiamiento" role="img" viewBox="0 0 42 42">
            <circle className="donut-base" cx="21" cy="21" fill="none" pathLength="100" r="15.9" />
            {items.map((item) => (
              <circle
                className={`donut-segment donut-${item.tone}`}
                cx="21"
                cy="21"
                fill="none"
                key={item.label}
                pathLength="100"
                r="15.9"
                strokeDasharray={`${item.share} ${100 - item.share}`}
                strokeDashoffset={item.offset}
              />
            ))}
          </svg>
          <div className="donut-center">
            <strong>{percent(Math.max(result.equity, 0) / total)}</strong>
            <span>capital propio</span>
          </div>
        </div>
        <div className="donut-legend">
          {items.map((item) => (
            <div key={item.label}>
              <i className={`legend-dot legend-${item.tone}`} />
              <span>{item.label}</span>
              <strong>{percent(item.share / 100)}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Dashboard({
  data,
  company,
  isDemo,
  saved,
  navigate,
}: {
  data: FinancialData;
  company: string;
  isDemo: boolean;
  saved: SavedAnalysis[];
  navigate: (section: Section) => void;
}) {
  const result = calculateFinancials(data);
  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => navigate("diagnostico")}>
            <Icon name="plus" /> Nuevo análisis
          </Button>
        }
        description={`Sociedad: ${company || "Sin empresa seleccionada"}`}
        title="Hola, Jefe Anthony"
      />
      {isDemo && <DemoBanner />}
      <div className="metrics-grid">
        <MetricCard
          detail="Activo corriente / Pasivo corriente"
          label="Liquidez corriente"
          progress={((result.currentRatio ?? 0) / 2) * 100}
          progressLabel={`${Math.round((result.currentRatio ?? 0) * 100)}% de cobertura corriente`}
          value={result.currentRatio === null ? "No disponible" : result.currentRatio.toFixed(2)}
        />
        <MetricCard
          detail="Pasivo total sobre activo total"
          label="Endeudamiento"
          progress={(result.debtRatio ?? 0) * 100}
          progressLabel={`${Math.round((result.debtRatio ?? 0) * 100)}% de los activos`}
          tone="orange"
          value={result.debtRatio === null ? "No disponible" : percent(result.debtRatio)}
        />
        <MetricCard
          detail="Resultado neto sobre ventas"
          label="Margen neto"
          progress={(result.netMargin ?? 0) * 100}
          progressLabel={`${Math.round((result.netMargin ?? 0) * 100)}% de cada venta`}
          tone="green"
          value={result.netMargin === null ? "No disponible" : percent(result.netMargin)}
        />
        <MetricCard
          detail="Disponible para operar en el corto plazo"
          label="Capital de trabajo"
          progress={(result.workingCapital / Math.max(data.currentAssets, 1)) * 100}
          progressLabel={`${Math.round((result.workingCapital / Math.max(data.currentAssets, 1)) * 100)}% del activo corriente`}
          tone="violet"
          value={currency(result.workingCapital)}
        />
      </div>
      <div className="insight-charts-grid">
        <CashFlowChart data={data} />
        <DonutBreakdown data={data} result={result} />
        <LineChart
          labels={["Año 1", "Año 2", "Año 3", "Año 4", "Año 5"]}
          series={[
            { name: "Optimista", values: [0.78, 0.9, 1.02, 1.16, 1.3].map((factor) => (data.revenue / 1000000) * factor), color: "green" },
            { name: "Base", values: [0.7, 0.78, 0.87, 0.97, 1.08].map((factor) => (data.revenue / 1000000) * factor), color: "blue" },
            { name: "Pesimista", values: [0.61, 0.66, 0.72, 0.78, 0.84].map((factor) => (data.revenue / 1000000) * factor), color: "red" },
          ]}
          title="Escenarios de rentabilidad"
        />
      </div>
      <section className="recommendation-banner">
        <span className="recommendation-icon"><Icon name="info" size={24} /></span>
        <div>
          <strong>Recomendación del sistema</strong>
          <p>La empresa mantiene una liquidez de {result.currentRatio?.toFixed(2) ?? "valor no disponible"} y un margen neto de {result.netMargin === null ? "valor no disponible" : percent(result.netMargin)}. Conviene revisar el impacto de los intereses, que representan {percent(data.interest / Math.max(result.operatingResult, 1))} del resultado operativo.</p>
        </div>
        <Button onClick={() => navigate("informes")}>Ver informe completo <Icon name="arrow" /></Button>
      </section>
      <div className="dashboard-grid lower-grid">
        <ComparisonBars
          items={[
            { label: "Activo", value: result.totalAssets, tone: "blue" },
            { label: "Pasivo", value: result.totalLiabilities, tone: "orange" },
            { label: "Patrimonio", value: result.equity, tone: "green" },
          ]}
          title="Estructura patrimonial"
        />
        <section className="card">
          <div className="card-heading">
            <div>
              <Heading level={3}>Análisis recientes</Heading>
              <p>Últimos registros guardados en este dispositivo</p>
            </div>
            <Button variant="ghost" onClick={() => navigate("historial")}>Ver todos</Button>
          </div>
          <div className="activity-list">
            {(saved.length ? saved.slice(0, 3) : [{
              id: 0,
              name: "Sin análisis guardados",
              company: "Completá un diagnóstico para comenzar",
              date: "—",
              type: "Diagnóstico",
              period: "—",
              result: 0,
            }]).map((item) => (
              <div className="activity-item" key={item.id}>
                <span className="activity-icon"><Icon name="report" /></span>
                <div><strong>{item.name}</strong><span>{item.company}</span></div>
                <time>{item.date}</time>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

type ImportedDocument = {
  name: string;
  date: string;
  fields: number;
  type: string;
  period?: string;
  company?: string;
  cuit?: string;
  coverage: number;
  detected: DocumentImportResult["detected"];
  findings: string[];
  warnings: string[];
};

function DataWorkspace({
  data,
  documents,
  setData,
  setDocuments,
  setCompany,
  setPeriod,
  setIsDemo,
  notify,
  navigate,
}: {
  data: FinancialData;
  documents: ImportedDocument[];
  setData: (data: FinancialData) => void;
  setDocuments: (documents: ImportedDocument[]) => void;
  setCompany: (company: string) => void;
  setPeriod: (period: string) => void;
  setIsDemo: (value: boolean) => void;
  notify: (message: string) => void;
  navigate: (section: Section) => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [detected, setDetected] = useState<{ label: string; value: number }[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<ImportedDocument | null>(null);

  const processFile = async (file?: File) => {
    if (!file) return;
    setProcessing(true);
    setError("");
    setDetected([]);
    try {
      const result = await importFinancialDocument(file);
      const mergedData = { ...data, ...result.values };
      setData(mergedData);
      setIsDemo(false);
      setDetected(result.detected);
      if (result.metadata.company) setCompany(result.metadata.company);
      if (result.metadata.period) setPeriod(result.metadata.period);
      const calculated = calculateFinancials(mergedData);
      const generatedFindings = [
        ...result.findings,
        calculated.currentRatio !== null
          ? `La liquidez corriente resultante es ${calculated.currentRatio.toFixed(2)}.`
          : "No es posible calcular la liquidez corriente.",
        calculated.netMargin !== null
          ? `El margen neto resultante es ${percent(calculated.netMargin)}.`
          : "No es posible calcular el margen neto.",
      ];
      const record: ImportedDocument = {
        name: file.name,
        date: new Intl.DateTimeFormat("es-AR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date()),
        fields: result.detected.length,
        type: result.metadata.documentType,
        period: result.metadata.period,
        company: result.metadata.company,
        cuit: result.metadata.cuit,
        coverage: result.coverage,
        detected: result.detected,
        findings: generatedFindings,
        warnings: result.warnings,
      };
      const nextDocuments = [record, ...documents].slice(0, 5);
      setDocuments(nextDocuments);
      setLatestAnalysis(record);
      notify(`Se actualizaron ${result.detected.length} datos financieros.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos procesar el archivo.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <PageHeader
        description="Centralizá tus estados contables e información financiera. Al importar un archivo, los módulos vinculados se actualizan automáticamente."
        eyebrow="Espacio de trabajo"
        title="Datos"
      />
      <section className="card data-upload-card">
        <div className="data-upload-intro">
          <span className="data-upload-icon"><Icon name="database" size={26} /></span>
          <div>
            <Heading level={2}>Importá información financiera</Heading>
            <p>El sistema identifica conceptos e importes de estados contables y los vincula con el diagnóstico, dashboard, simulaciones, gráficos e informes.</p>
          </div>
        </div>
        <label className={`upload-zone ${processing ? "processing" : ""}`}>
          <Input
            accept=".pdf,.docx,.xls,.xlsx"
            aria-label="Seleccionar archivo financiero"
            disabled={processing}
            type="file"
            onChange={(event) => {
              void processFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <span className="upload-zone-icon"><Icon name="upload" size={28} /></span>
          <strong>{processing ? "Analizando el documento..." : "Seleccioná un archivo para importar"}</strong>
          <span>PDF, Word (.docx) o Excel (.xls y .xlsx)</span>
          <small>Tamaño recomendado: hasta 10 MB</small>
        </label>
        <div className="data-security-note">
          <Icon name="check" />
          <span><strong>Procesamiento privado en tu navegador.</strong> El archivo no se almacena ni se envía a servicios externos.</span>
        </div>
      </section>

      {error && (
        <div className="alert danger data-import-alert" role="alert">
          <Icon name="alert" />
          <div><strong>No se pudo completar la importación</strong><span>{error}</span></div>
        </div>
      )}

      {detected.length > 0 && (
        <section className="card detected-data-card">
          <div className="card-heading">
            <div><Heading level={3}>Datos reconocidos</Heading><p>Estos importes ya se aplicaron al resto del espacio de trabajo.</p></div>
            <span className="status status-positive">{detected.length} campos actualizados</span>
          </div>
          <div className="detected-data-grid">
            {detected.map((item) => (
              <div key={item.label}><span>{item.label}</span><strong>{currency(item.value)}</strong></div>
            ))}
          </div>
          {latestAnalysis && (
            <div className="document-analysis">
              <div className="analysis-summary">
                <span>
                  <small>Tipo detectado</small>
                  <strong>{latestAnalysis.type}</strong>
                </span>
                <span>
                  <small>Período</small>
                  <strong>{latestAnalysis.period ?? "No identificado"}</strong>
                </span>
                <span>
                  <small>Cobertura</small>
                  <strong>{latestAnalysis.coverage}% del modelo</strong>
                </span>
              </div>
              <div className="analysis-columns">
                <div>
                  <strong>Información pertinente</strong>
                  <ul>{latestAnalysis.findings.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <strong>Datos a revisar</strong>
                  <ul>{latestAnalysis.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
              <div className="analysis-actions">
                <span><Icon name="check" /> Este análisis quedará incluido en el informe financiero final.</span>
                <Button variant="secondary" onClick={() => navigate("informes")}>
                  Ver informe actualizado <Icon name="arrow" />
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card imported-files-card">
        <div className="card-heading">
          <div><Heading level={3}>Archivos recientes</Heading><p>Últimas importaciones realizadas en este dispositivo.</p></div>
        </div>
        {documents.length ? (
          <div className="imported-files-list">
            {documents.map((document, index) => (
              <div key={`${document.name}-${document.date}-${index}`}>
                <span className="file-type-icon"><Icon name="file" /></span>
                <div><strong>{document.name}</strong><span>{document.type || "Documento financiero"} · {document.fields} datos reconocidos</span></div>
                <time>{document.date}</time>
                <span className="status status-positive"><Icon name="check" size={13} /> Procesado</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="data-empty-state">
            <Icon name="file" size={30} />
            <div><strong>Todavía no importaste archivos</strong><span>Tu historial de cargas aparecerá en este espacio.</span></div>
          </div>
        )}
      </section>
      <div className="method-note">
        <Icon name="info" />
        <p><strong>Revisión recomendada.</strong> La lectura automática depende de la estructura y calidad del archivo. Verificá los valores reconocidos en Diagnóstico financiero antes de tomar decisiones.</p>
      </div>
    </>
  );
}

const financialFields: { key: keyof FinancialData; label: string; group: string }[] = [
  { key: "currentAssets", label: "Activo corriente", group: "Patrimonio" },
  { key: "nonCurrentAssets", label: "Activo no corriente", group: "Patrimonio" },
  { key: "currentLiabilities", label: "Pasivo corriente", group: "Patrimonio" },
  { key: "nonCurrentLiabilities", label: "Pasivo no corriente", group: "Patrimonio" },
  { key: "revenue", label: "Ventas e ingresos", group: "Resultados" },
  { key: "costs", label: "Costos", group: "Resultados" },
  { key: "operatingExpenses", label: "Gastos operativos", group: "Resultados" },
  { key: "interest", label: "Intereses y costos financieros", group: "Resultados" },
  { key: "taxes", label: "Impuestos", group: "Resultados" },
  { key: "openingEquity", label: "Patrimonio neto al inicio", group: "Evolución" },
  { key: "contributions", label: "Aportes de socios", group: "Evolución" },
  { key: "distributions", label: "Retiros, dividendos y distribuciones", group: "Evolución" },
  { key: "openingCash", label: "Efectivo al inicio del período", group: "Flujo" },
  { key: "operatingCashFlow", label: "Flujo de actividades operativas", group: "Flujo" },
  { key: "investingCashFlow", label: "Flujo de actividades de inversión", group: "Flujo" },
  { key: "financingCashFlow", label: "Flujo de actividades de financiación", group: "Flujo" },
];

function Diagnostic({
  data,
  setData,
  company,
  setCompany,
  period,
  setPeriod,
  isDemo,
  setIsDemo,
  save,
  navigate,
}: {
  data: FinancialData;
  setData: (data: FinancialData) => void;
  company: string;
  setCompany: (name: string) => void;
  period: string;
  setPeriod: (period: string) => void;
  isDemo: boolean;
  setIsDemo: (value: boolean) => void;
  save: () => void;
  navigate: (section: Section) => void;
}) {
  const result = calculateFinancials(data);
  const update = (key: keyof FinancialData, value: string) => {
    setIsDemo(false);
    const allowsNegative = ["operatingCashFlow", "investingCashFlow", "financingCashFlow"].includes(key);
    setData({ ...data, [key]: allowsNegative ? Number(value) : Math.max(Number(value), 0) });
  };
  const indicators = [
    {
      name: "Liquidez corriente",
      value: result.currentRatio?.toFixed(2) ?? "No calculable",
      formula: "Activo corriente / Pasivo corriente",
      used: `${currency(data.currentAssets)} / ${currency(data.currentLiabilities)}`,
      interpretation:
        result.currentRatio === null
          ? "Ingresá un pasivo corriente mayor a cero."
          : "Indica el respaldo disponible para obligaciones de corto plazo.",
    },
    {
      name: "Endeudamiento",
      value: result.debtRatio === null ? "No calculable" : percent(result.debtRatio),
      formula: "Pasivo total / Activo total",
      used: `${currency(result.totalLiabilities)} / ${currency(result.totalAssets)}`,
      interpretation: "Muestra qué parte de los activos está financiada por terceros.",
    },
    {
      name: "Margen neto",
      value: result.netMargin === null ? "No calculable" : percent(result.netMargin),
      formula: "Resultado neto / Ventas × 100",
      used: `${currency(result.netResult)} / ${currency(data.revenue)}`,
      interpretation: "Expresa cuánto resultado queda por cada peso vendido.",
    },
    {
      name: "ROE",
      value: result.roe === null ? "No calculable" : percent(result.roe),
      formula: "Resultado neto / Patrimonio neto final",
      used: `${currency(result.netResult)} / ${currency(result.equity)}`,
      interpretation: "Estima el retorno sobre el patrimonio al cierre del período.",
    },
  ];
  return (
    <>
      <PageHeader
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("informes")}>
              <Icon name="report" /> Generar informe
            </Button>
            <Button onClick={save}><Icon name="check" /> Guardar análisis</Button>
          </>
        }
        description="Cargá los cuatro estados contables básicos. Los indicadores se actualizan automáticamente."
        eyebrow="Módulo 1"
        title="Diagnóstico financiero"
      />
      {isDemo && <DemoBanner />}
      <div className="steps">
        <span className="step active"><i>1</i><b>Datos de la empresa</b></span>
        <span className="step active"><i>2</i><b>Información contable</b></span>
        <span className="step active"><i>3</i><b>Resultados</b></span>
      </div>
      <section className="card form-card">
        <div className="card-heading">
          <div><Heading level={3}>Identificación del análisis</Heading><p>Información general y período evaluado</p></div>
          <Button
            variant="ghost"
            onClick={() => {
              setData(emptyFinancials);
              setCompany("");
              setIsDemo(false);
            }}
          >
            Limpiar datos
          </Button>
        </div>
        <div className="form-grid form-grid-3">
          <Field label="Empresa">
            <Input value={company} onChange={(event) => { setCompany(event.target.value); setIsDemo(false); }} />
          </Field>
          <Field label="Período">
            <Input value={period} onChange={(event) => setPeriod(event.target.value)} />
          </Field>
          <Field label="Moneda">
            <Select defaultValue="ARS"><option value="ARS">Peso argentino ($ ARS)</option><option value="USD">Dólar estadounidense (USD)</option></Select>
          </Field>
        </div>
      </section>
      {["Patrimonio", "Resultados", "Evolución", "Flujo"].map((group) => (
        <section className="card form-card" key={group}>
          <div className="card-heading">
            <div>
              <Heading level={3}>{
                group === "Patrimonio" ? "Estado de situación patrimonial"
                  : group === "Resultados" ? "Estado de resultados"
                    : group === "Evolución" ? "Estado de evolución del patrimonio neto"
                      : "Estado de flujo de efectivo"
              }</Heading>
              <p>{group === "Flujo" ? "Usá valores negativos para salidas netas de efectivo." : "Ingresá importes expresados en pesos argentinos."}</p>
            </div>
          </div>
          <div className="form-grid form-grid-3">
            {financialFields.filter((field) => field.group === group).map((field) => (
              <Field hint="Ejemplo: 1.500.000" key={field.key} label={field.label}>
                <div className="currency-input"><span>$</span><Input min="0" step="1000" type="number" value={data[field.key]} onChange={(event) => update(field.key, event.target.value)} /></div>
              </Field>
            ))}
          </div>
          <div className="totals-row">
            {group === "Patrimonio" ? (
              <>
                <span>Activo total <strong>{currency(result.totalAssets)}</strong></span>
                <span>Pasivo total <strong>{currency(result.totalLiabilities)}</strong></span>
                <span>Patrimonio neto <strong>{currency(result.equity)}</strong></span>
              </>
            ) : group === "Resultados" ? (
              <>
                <span>Resultado operativo <strong>{currency(result.operatingResult)}</strong></span>
                <span>Resultado neto <strong>{currency(result.netResult)}</strong></span>
              </>
            ) : group === "Evolución" ? (
              <>
                <span>Resultado del período <strong>{currency(result.netResult)}</strong></span>
                <span>Patrimonio neto al cierre <strong>{currency(result.equityFromEvolution)}</strong></span>
                <span>Diferencia con situación patrimonial <strong>{currency(result.equityEvolutionDifference)}</strong></span>
              </>
            ) : (
              <>
                <span>Variación neta del efectivo <strong>{currency(result.cashChange)}</strong></span>
                <span>Efectivo al cierre <strong>{currency(result.closingCash)}</strong></span>
              </>
            )}
          </div>
        </section>
      ))}
      <div className="section-title">
        <div><span className="eyebrow">Resultados calculados</span><Heading level={2}>Indicadores clave</Heading></div>
        <span className="context-note"><Icon name="info" /> Interpretar siempre según sector y período</span>
      </div>
      <div className="indicator-grid">
        {indicators.map((indicator) => (
          <article className="card indicator-card" key={indicator.name}>
            <span>{indicator.name}</span>
            <strong>{indicator.value}</strong>
            <p>{indicator.interpretation}</p>
            <details>
              <summary>Ver fórmula y valores</summary>
              <div><code>{indicator.formula}</code><span>{indicator.used}</span></div>
            </details>
          </article>
        ))}
      </div>
      <div className="method-note">
        <Icon name="info" />
        <p><strong>Alcance del cálculo.</strong> ROA y ROE usan saldos finales porque no se cargaron promedios. La prueba ácida requiere inventarios, que no forman parte de esta carga básica. Estos indicadores orientan el análisis, pero no reemplazan la evaluación del sector y el contexto.</p>
      </div>
    </>
  );
}

function Financing() {
  const [loans, setLoans] = useState(initialLoans);
  const results = loans.map(calculateLoan);
  const update = (index: number, key: keyof LoanInput, value: string) => {
    const next = [...loans];
    next[index] = { ...next[index], [key]: key === "name" ? value : Math.max(Number(value), 0) };
    setLoans(next);
  };
  return (
    <>
      <PageHeader
        description="Compará cuotas, intereses y costos de dos alternativas bajo las mismas condiciones."
        eyebrow="Módulo 2"
        title="Evaluación de financiamiento"
      />
      <div className="info-strip"><Icon name="info" /><span>La simulación usa sistema francés y TNA. Como no incluye seguros ni impuestos, el costo es parcial y no constituye un CFT exacto.</span></div>
      <div className="loan-grid">
        {loans.map((loan, index) => (
          <section className="card form-card" key={index}>
            <div className="option-label"><span>Alternativa {index + 1}</span><strong>{loan.name}</strong></div>
            <div className="form-grid form-grid-2">
              <Field label="Nombre de la entidad"><Input value={loan.name} onChange={(e) => update(index, "name", e.target.value)} /></Field>
              <Field label="Importe solicitado"><Input min="1" type="number" value={loan.amount} onChange={(e) => update(index, "amount", e.target.value)} /></Field>
              <Field hint="Tasa nominal anual" label="TNA"><div className="suffix-input"><Input min="0" type="number" value={loan.annualRate} onChange={(e) => update(index, "annualRate", e.target.value)} /><span>%</span></div></Field>
              <Field label="Plazo en meses"><Input min="1" type="number" value={loan.months} onChange={(e) => update(index, "months", e.target.value)} /></Field>
              <Field label="Comisiones informadas"><Input min="0" type="number" value={loan.fees} onChange={(e) => update(index, "fees", e.target.value)} /></Field>
              <Field label="Sistema"><Select defaultValue="frances"><option value="frances">Francés</option></Select></Field>
            </div>
            <div className="loan-result">
              <div><span>Cuota estimada</span><strong>{currency(results[index].payment)}</strong></div>
              <div><span>Total a pagar</span><strong>{currency(results[index].total)}</strong></div>
              <div><span>Intereses</span><strong>{currency(results[index].interest)}</strong></div>
            </div>
          </section>
        ))}
      </div>
      <div className="finance-comparison">
        <ComparisonBars
          items={results.map((result, index) => ({ label: loans[index].name, value: result.total, tone: index ? "violet" : "blue" }))}
          title="Comparación del costo total estimado"
        />
      </div>
      <section className="card table-card">
        <div className="card-heading"><div><Heading level={3}>Primeras cuotas y saldo pendiente</Heading><p>Cronograma estimado de amortización</p></div></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Período</th>{loans.map((loan) => <th key={loan.name}>{loan.name}</th>)}</tr></thead>
            <tbody>{Array.from({ length: Math.min(6, ...loans.map((loan) => loan.months)) }, (_, index) => <tr key={index}><td>Cuota {index + 1}</td>{results.map((result, resultIndex) => <td key={resultIndex}>{currency(result.schedule[index]?.balance ?? 0)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Projects() {
  const [projects, setProjects] = useState(initialProjects);
  const update = (index: number, key: keyof ProjectInput, value: string) => {
    const next = [...projects];
    next[index] = { ...next[index], [key]: key === "name" ? value : Number(value) };
    setProjects(next);
  };
  return (
    <>
      <PageHeader description="Evaluá proyectos a partir de flujos explícitos y una tasa de descuento definida." eyebrow="Módulo 3" title="Proyectos de inversión" />
      <DemoBanner />
      <div className="loan-grid">
        {projects.map((project, index) => {
          const projectNpv = npv(project);
          const projectIrr = irr(project);
          const projectPayback = payback(project);
          return (
            <section className="card project-card" key={index}>
              <div className="option-label"><span>Proyecto {index + 1}</span><strong>{project.name}</strong></div>
              <div className="form-grid form-grid-2">
                <Field label="Nombre"><Input value={project.name} onChange={(e) => update(index, "name", e.target.value)} /></Field>
                <Field label="Inversión inicial"><Input min="0" type="number" value={project.initialInvestment} onChange={(e) => update(index, "initialInvestment", e.target.value)} /></Field>
                <Field label="Tasa de descuento"><div className="suffix-input"><Input min="0" type="number" value={project.discountRate} onChange={(e) => update(index, "discountRate", e.target.value)} /><span>%</span></div></Field>
                <Field label="Valor residual"><Input min="0" type="number" value={project.residualValue} onChange={(e) => update(index, "residualValue", e.target.value)} /></Field>
              </div>
              <div className="cashflow-fields">
                {project.flows.map((flow, flowIndex) => (
                  <Field key={flowIndex} label={`Año ${flowIndex + 1}`}>
                    <Input type="number" value={flow} onChange={(event) => {
                      const next = [...projects];
                      next[index].flows = [...next[index].flows];
                      next[index].flows[flowIndex] = Number(event.target.value);
                      setProjects(next);
                    }} />
                  </Field>
                ))}
              </div>
              <div className="project-results">
                <div><span>VAN</span><strong className={projectNpv >= 0 ? "positive-text" : "negative-text"}>{currency(projectNpv)}</strong><small>A la tasa de {project.discountRate}%</small></div>
                <div><span>TIR estimada</span><strong>{projectIrr === null ? "No calculable" : percent(projectIrr)}</strong><small>Tasa que lleva el VAN a cero</small></div>
                <div><span>Payback simple</span><strong>{projectPayback === null ? "No recupera" : `${projectPayback.toFixed(1)} años`}</strong><small>No considera valor tiempo</small></div>
              </div>
            </section>
          );
        })}
      </div>
      <div className="method-note"><Icon name="alert" /><p><strong>Interpretación responsable.</strong> Un VAN positivo indica creación de valor respecto de la tasa elegida, no garantiza el resultado. La TIR puede ser ambigua con flujos que cambian de signo varias veces. Revisá siempre los supuestos.</p></div>
    </>
  );
}

function Scenarios({ data }: { data: FinancialData }) {
  const [salesChange, setSalesChange] = useState(0);
  const [costChange, setCostChange] = useState(0);
  const base = calculateFinancials(data);
  const scenarios = [
    { name: "Optimista", sales: salesChange + 10, costs: costChange - 5, tone: "green" },
    { name: "Base", sales: salesChange, costs: costChange, tone: "blue" },
    { name: "Pesimista", sales: salesChange - 15, costs: costChange + 10, tone: "orange" },
  ].map((scenario) => {
    const revenue = data.revenue * (1 + scenario.sales / 100);
    const costs = (data.costs + data.operatingExpenses) * (1 + scenario.costs / 100);
    const result = revenue - costs - data.interest - data.taxes;
    return { ...scenario, revenue, costs, result, margin: revenue ? result / revenue : 0 };
  });
  return (
    <>
      <PageHeader description="Explorá el impacto de tus supuestos. Los resultados cambian en tiempo real." eyebrow="Módulo 4" title="Simulador de escenarios" />
      <div className="simulation-note"><Icon name="info" /><p><strong>Esto es una simulación, no una predicción.</strong> Los resultados dependen exclusivamente de los supuestos visibles y no garantizan desempeño futuro.</p></div>
      <section className="card controls-card">
        <div className="card-heading"><div><Heading level={3}>Supuestos ajustables</Heading><p>Los cambios se aplican sobre el escenario base cargado.</p></div><span className="base-value">Resultado base: {currency(base.netResult)}</span></div>
        <div className="range-grid">
          <Field label={`Variación adicional de ventas: ${salesChange}%`}>
            <Input max="30" min="-30" type="range" value={salesChange} onChange={(event) => setSalesChange(Number(event.target.value))} />
          </Field>
          <Field label={`Variación adicional de costos: ${costChange}%`}>
            <Input max="30" min="-30" type="range" value={costChange} onChange={(event) => setCostChange(Number(event.target.value))} />
          </Field>
        </div>
      </section>
      <div className="scenario-grid">
        {scenarios.map((scenario) => (
          <article className={`card scenario-card scenario-${scenario.tone}`} key={scenario.name}>
            <div className="scenario-title"><span className="metric-dot" /><Heading level={3}>{scenario.name}</Heading></div>
            <span>Resultado estimado</span>
            <strong>{currency(scenario.result)}</strong>
            <div className="scenario-stats">
              <span>Margen neto <b>{percent(scenario.margin)}</b></span>
              <span>Vs. base <b>{percent((scenario.result - base.netResult) / Math.max(Math.abs(base.netResult), 1))}</b></span>
              <span>Ventas <b>{scenario.sales > 0 ? "+" : ""}{scenario.sales}%</b></span>
            </div>
          </article>
        ))}
      </div>
      <div className="scenario-comparison">
        <ComparisonBars items={scenarios.map((scenario) => ({ label: scenario.name, value: Math.max(scenario.result, 0), tone: scenario.tone }))} title="Resultado por escenario" />
      </div>
      {scenarios.some((scenario) => scenario.result < 0) && <div className="alert danger"><Icon name="alert" /><div><strong>Escenario desfavorable detectado</strong><span>Al menos una combinación produce pérdidas. Revisá costos, ventas y capacidad de pago antes de decidir.</span></div></div>}
    </>
  );
}

function Reports({
  data,
  company,
  period,
  documents,
}: {
  data: FinancialData;
  company: string;
  period: string;
  documents: ImportedDocument[];
}) {
  const latestDocument = documents[0];
  const [reportProfile, setReportProfile] = useState({
    cuit: latestDocument?.cuit ?? "",
    address: "",
    activity: "",
  });
  useEffect(() => {
    if (latestDocument?.cuit && !reportProfile.cuit) {
      setReportProfile((profile) => ({ ...profile, cuit: latestDocument.cuit ?? "" }));
    }
  }, [latestDocument?.cuit, reportProfile.cuit]);
  const result = calculateFinancials(data);
  const print = () => window.print();
  const indicatorDetails = [
    {
      name: "Liquidez corriente",
      result: result.currentRatio?.toFixed(2) ?? "No calculable",
      formula: "Activo corriente / Pasivo corriente",
      calculation: `${currency(data.currentAssets)} / ${currency(data.currentLiabilities)}`,
      meaning: "Indica cuántos pesos de activos corrientes respaldan cada peso de deuda exigible en el corto plazo.",
      interpretation: result.currentRatio === null
        ? "No se puede interpretar porque el pasivo corriente es cero."
        : `La empresa dispone de ${result.currentRatio.toFixed(2)} pesos de activo corriente por cada peso de obligación corriente.`,
    },
    {
      name: "Capital de trabajo",
      result: currency(result.workingCapital),
      formula: "Activo corriente − Pasivo corriente",
      calculation: `${currency(data.currentAssets)} − ${currency(data.currentLiabilities)}`,
      meaning: "Estima los recursos corrientes que quedan disponibles luego de cubrir las obligaciones de corto plazo.",
      interpretation: `El excedente corriente calculado es de ${currency(result.workingCapital)}. Su suficiencia depende del ciclo operativo y la estacionalidad.`,
    },
    {
      name: "Endeudamiento",
      result: result.debtRatio === null ? "No calculable" : percent(result.debtRatio),
      formula: "Pasivo total / Activo total × 100",
      calculation: `${currency(result.totalLiabilities)} / ${currency(result.totalAssets)} × 100`,
      meaning: "Mide qué proporción de los activos de la empresa se encuentra financiada con obligaciones de terceros.",
      interpretation: result.debtRatio === null ? "No existe un activo total válido para calcularlo." : `${percent(result.debtRatio)} de los activos está financiado con pasivos. Debe compararse con el sector y períodos anteriores.`,
    },
    {
      name: "Margen operativo",
      result: result.operatingMargin === null ? "No calculable" : percent(result.operatingMargin),
      formula: "Resultado operativo / Ventas × 100",
      calculation: `${currency(result.operatingResult)} / ${currency(data.revenue)} × 100`,
      meaning: "Muestra qué porcentaje de las ventas queda luego de costos y gastos operativos, antes de intereses e impuestos.",
      interpretation: result.operatingMargin === null ? "No se informaron ventas válidas." : `La actividad principal genera un margen operativo de ${percent(result.operatingMargin)}.`,
    },
    {
      name: "Margen neto",
      result: result.netMargin === null ? "No calculable" : percent(result.netMargin),
      formula: "Resultado neto / Ventas × 100",
      calculation: `${currency(result.netResult)} / ${currency(data.revenue)} × 100`,
      meaning: "Expresa cuánto resultado final queda por cada peso vendido, después de costos, gastos, intereses e impuestos.",
      interpretation: result.netMargin === null ? "No se informaron ventas válidas." : `Por cada $100 vendidos quedan aproximadamente ${currency((result.netMargin ?? 0) * 100)} de resultado neto.`,
    },
    {
      name: "ROA",
      result: result.roa === null ? "No calculable" : percent(result.roa),
      formula: "Resultado neto / Activo total final × 100",
      calculation: `${currency(result.netResult)} / ${currency(result.totalAssets)} × 100`,
      meaning: "Estima la capacidad de los activos para producir resultados, sin distinguir cómo fueron financiados.",
      interpretation: `Se utilizó el activo al cierre porque no se cargaron saldos promedio. El resultado es ${result.roa === null ? "no calculable" : percent(result.roa)}.`,
    },
    {
      name: "ROE",
      result: result.roe === null ? "No calculable" : percent(result.roe),
      formula: "Resultado neto / Patrimonio neto final × 100",
      calculation: `${currency(result.netResult)} / ${currency(result.equity)} × 100`,
      meaning: "Estima la rentabilidad obtenida sobre el capital contable de los propietarios.",
      interpretation: `Se utilizó el patrimonio al cierre. El resultado debe evaluarse junto con el nivel de deuda y es ${result.roe === null ? "no calculable" : percent(result.roe)}.`,
    },
  ];
  const inputRows = [
    ["Activo corriente", data.currentAssets],
    ["Activo no corriente", data.nonCurrentAssets],
    ["Pasivo corriente", data.currentLiabilities],
    ["Pasivo no corriente", data.nonCurrentLiabilities],
    ["Ventas e ingresos", data.revenue],
    ["Costos", data.costs],
    ["Gastos operativos", data.operatingExpenses],
    ["Intereses y costos financieros", data.interest],
    ["Impuestos", data.taxes],
  ] as const;
  return (
    <>
      <PageHeader
        actions={<Button onClick={print}><Icon name="download" /> Descargar PDF</Button>}
        description="Previsualizá un documento consistente con los datos calculados en la plataforma."
        eyebrow="Módulo 5"
        title="Informe financiero"
      />
      <div className="report-toolbar">
        <span className="status status-neutral">Formato profesional completo</span>
        <span>Generado el {new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date())}</span>
      </div>
      <section className="card report-profile-form">
        <div className="card-heading"><div><Heading level={3}>Datos de la carátula</Heading><p>Completá estos campos antes de descargar el informe.</p></div></div>
        <div className="form-grid form-grid-3">
          <Field label="CUIT"><Input placeholder="Ej.: 30-12345678-9" value={reportProfile.cuit} onChange={(event) => setReportProfile({ ...reportProfile, cuit: event.target.value })} /></Field>
          <Field label="Actividad de la sociedad"><Input placeholder="Ej.: Servicios profesionales" value={reportProfile.activity} onChange={(event) => setReportProfile({ ...reportProfile, activity: event.target.value })} /></Field>
          <Field label="Domicilio"><Input placeholder="Ej.: Av. Corrientes 1234, CABA" value={reportProfile.address} onChange={(event) => setReportProfile({ ...reportProfile, address: event.target.value })} /></Field>
        </div>
      </section>
      <article className="report-page">
        <header className="report-cover">
          <Logo compact />
          <div><span>INFORME DE ANÁLISIS FINANCIERO Y ECONÓMICO</span><Heading level={1}>{company || "Empresa sin identificar"}</Heading><p>Período analizado: ejercicio {period || "no informado"}</p></div>
          <span className="status status-neutral">Confidencial</span>
          <div className="cover-details">
            <span><small>CUIT</small><strong>{reportProfile.cuit || "No informado"}</strong></span>
            <span><small>Actividad</small><strong>{reportProfile.activity || "No informada"}</strong></span>
            <span><small>Domicilio</small><strong>{reportProfile.address || "No informado"}</strong></span>
            <span><small>Fecha de emisión</small><strong>{new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date())}</strong></span>
          </div>
        </header>
        <section className="report-section report-sources">
          <span className="section-number">00</span>
          <div>
            <span className="audit-kicker">Origen de la información</span>
            <Heading level={2}>Fuentes y trazabilidad</Heading>
            {documents.length ? (
              <>
                <p>Los datos utilizados fueron reconocidos automáticamente a partir de los siguientes documentos adjuntados en la solapa Datos. Los importes se integraron al modelo financiero y deben ser validados contra la documentación original.</p>
                <div className="report-source-list">
                  {documents.map((document, index) => (
                    <div key={`${document.name}-${document.date}-${index}`}>
                      <span className="file-type-icon"><Icon name="file" /></span>
                      <div>
                        <strong>{document.name}</strong>
                        <span>{document.type || "Documento financiero"} · importado el {document.date}</span>
                      </div>
                      <span className="status status-neutral">{document.fields} datos · {document.coverage || 0}% cobertura</span>
                    </div>
                  ))}
                </div>
                {latestDocument && (
                  <div className="report-import-analysis">
                    <Heading level={3}>Análisis automático de la última importación</Heading>
                    <div>
                      <section>
                        <strong>Hallazgos incorporados</strong>
                        <ul>{latestDocument.findings?.map((item) => <li key={item}>{item}</li>)}</ul>
                      </section>
                      <section>
                        <strong>Revisiones pendientes</strong>
                        <ul>{latestDocument.warnings?.map((item) => <li key={item}>{item}</li>)}</ul>
                      </section>
                    </div>
                    <div className="report-table-wrap">
                      <table>
                        <thead><tr><th>Dato reconocido</th><th>Importe aplicado</th></tr></thead>
                        <tbody>{latestDocument.detected?.map((item) => <tr key={item.key}><td>{item.label}</td><td>{currency(item.value)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="audit-limitations"><strong>Sin documentos adjuntos</strong><p>El informe se basa en los datos disponibles en la plataforma. Para incorporar trazabilidad, adjuntá un PDF, Word o Excel desde la solapa Datos.</p></div>
            )}
          </div>
        </section>
        <section className="report-section">
          <span className="section-number">01</span>
          <div>
            <span className="audit-kicker">Análisis patrimonial</span>
            <Heading level={2}>Situación financiera</Heading>
            <p>La situación financiera se evaluó considerando la composición del activo, las obligaciones corrientes y no corrientes, el patrimonio neto calculado y la capacidad de la sociedad para atender compromisos de corto plazo.</p>
            <div className="report-metrics">
              <div><span>Activo total</span><strong>{currency(result.totalAssets)}</strong></div>
              <div><span>Pasivo total</span><strong>{currency(result.totalLiabilities)}</strong></div>
              <div><span>Patrimonio neto</span><strong>{currency(result.equity)}</strong></div>
            </div>
            <div className="report-table-wrap">
              <table>
                <thead><tr><th>Concepto financiero</th><th>Importe</th></tr></thead>
                <tbody>
                  {inputRows.slice(0, 4).map(([label, value]) => <tr key={label}><td>{label}</td><td>{currency(value)}</td></tr>)}
                  <tr><td>Capital de trabajo</td><td>{currency(result.workingCapital)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="audit-index-row">
              {indicatorDetails.slice(0, 3).map((indicator) => <div key={indicator.name}><span>{indicator.name}</span><strong>{indicator.result}</strong><p>{indicator.meaning}</p><code>{indicator.formula}</code></div>)}
            </div>
          </div>
        </section>
        <section className="report-section">
          <span className="section-number">02</span>
          <div>
            <span className="audit-kicker">Desempeño del período</span>
            <Heading level={2}>Situación económica</Heading>
            <p>La situación económica refleja la capacidad de la actividad para generar resultados durante el período. Se consideraron ventas, costos, gastos operativos, costos financieros e impuestos informados.</p>
            <div className="economic-summary">
              <div><span>Ventas e ingresos</span><strong>{currency(data.revenue)}</strong></div>
              <div><span>Costos</span><strong>{currency(data.costs)}</strong></div>
              <div><span>Gastos operativos</span><strong>{currency(data.operatingExpenses)}</strong></div>
              <div><span>Resultado operativo</span><strong>{currency(result.operatingResult)}</strong></div>
              <div><span>Intereses</span><strong>{currency(data.interest)}</strong></div>
              <div><span>Impuestos</span><strong>{currency(data.taxes)}</strong></div>
              <div className="highlight"><span>Resultado neto</span><strong>{currency(result.netResult)}</strong></div>
            </div>
            <div className="audit-index-row">
              {indicatorDetails.slice(3).map((indicator) => <div key={indicator.name}><span>{indicator.name}</span><strong>{indicator.result}</strong><p>{indicator.meaning}</p><code>{indicator.formula}</code></div>)}
            </div>
          </div>
        </section>
        <section className="report-section">
          <span className="section-number">03</span>
          <div>
            <span className="audit-kicker">Evaluación integral</span>
            <Heading level={2}>Conclusiones</Heading>
            <div className="audit-narrative">
              <p><strong>Posición financiera.</strong> La liquidez corriente de {result.currentRatio?.toFixed(2) ?? "valor no calculable"} significa que la sociedad dispone de {result.currentRatio?.toFixed(2) ?? "información insuficiente"} pesos de activo corriente por cada peso de deuda exigible en el corto plazo. El capital de trabajo asciende a {currency(result.workingCapital)}. Este resultado constituye una ventaja cuando los activos corrientes son realizables en plazos compatibles con los vencimientos; sin información sobre inventarios, cobranzas y calendario de pagos no puede afirmarse por sí solo que no exista riesgo de liquidez.</p>
              <p><strong>Estructura de financiamiento.</strong> El índice de endeudamiento es {result.debtRatio === null ? "no calculable" : percent(result.debtRatio)}, por lo que esa proporción del activo se encuentra financiada por terceros. Una estructura con deuda puede potenciar el retorno del capital propio, pero también incrementa la exposición a tasas, refinanciaciones y restricciones de flujo de fondos.</p>
              <p><strong>Rentabilidad.</strong> El margen operativo alcanza {result.operatingMargin === null ? "un valor no calculable" : percent(result.operatingMargin)} y el margen neto {result.netMargin === null ? "un valor no calculable" : percent(result.netMargin)}. Esto indica qué proporción de las ventas permanece luego de absorber, respectivamente, los costos operativos y la totalidad de costos, intereses e impuestos. El ROA de {result.roa === null ? "valor no calculable" : percent(result.roa)} estima el rendimiento generado por los activos, mientras que el ROE de {result.roe === null ? "valor no calculable" : percent(result.roe)} representa el retorno contable sobre el patrimonio final.</p>
              <p><strong>Riesgos observados.</strong> Los intereses representan {percent(data.interest / Math.max(result.operatingResult, 1))} del resultado operativo. Entre las principales desventajas o puntos de atención se encuentran la sensibilidad ante una caída de ventas, el aumento de costos y tasas, y la falta de información comparativa, sectorial y de flujos de efectivo.</p>
            </div>
            <div className="report-recommendations">
              <Heading level={3}>Recomendaciones para la toma de decisiones</Heading>
              <ol>
                <li>Comparar los índices con al menos dos ejercicios anteriores y con empresas de actividad y escala similares.</li>
                <li>Elaborar un flujo de fondos mensual que confronte fechas efectivas de cobranzas, pagos y vencimientos financieros.</li>
                <li>Analizar la composición y recuperabilidad del activo corriente antes de asumir nuevas obligaciones.</li>
                <li>Simular escenarios de reducción de ventas, incremento de costos y aumento de tasas para medir la resistencia financiera.</li>
                <li>Evaluar alternativas de financiamiento por su CFT completo, plazo y efecto sobre la capacidad de pago, no solo por la cuota.</li>
              </ol>
            </div>
            <div className="audit-limitations">
              <strong>Alcance y limitaciones</strong>
              <p>El presente es un informe de análisis financiero confeccionado sobre datos ingresados por el usuario y, cuando corresponde, extraídos automáticamente de los documentos identificados en Fuentes y trazabilidad; no constituye un informe de auditoría ni una opinión profesional sobre estados contables. La extracción automática debe validarse contra los archivos originales. ROA y ROE utilizan saldos finales porque no se informaron promedios. No se consideraron inflación, estacionalidad, contingencias, composición de inventarios ni referencias sectoriales.</p>
            </div>
            <footer className="report-footer"><Logo compact /><span>IB1 · Decisiones financieras con información clara</span><time>{new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date())}</time></footer>
          </div>
        </section>
      </article>
    </>
  );
}

function Library() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const categories = ["Todas", ...new Set(concepts.map((concept) => concept.category))];
  const filtered = concepts.filter((concept) => (category === "Todas" || concept.category === category) && concept.term.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <PageHeader description="Conceptos financieros explicados de forma clara, con fórmulas y advertencias." eyebrow="Aprender para decidir" title="Biblioteca financiera" />
      <div className="library-tools">
        <div className="search-box"><Icon name="search" /><Input aria-label="Buscar conceptos" placeholder="Buscar por concepto..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <Select aria-label="Filtrar por categoría" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</Select>
      </div>
      <div className="concept-grid">
        {filtered.map((concept) => (
          <article className="card concept-card" key={concept.term}>
            <span className="category-tag">{concept.category}</span>
            <Heading level={3}>{concept.term}</Heading>
            <p>{concept.definition}</p>
            <div className="formula"><span>Cómo se calcula</span><code>{concept.formula}</code></div>
            <div className="example"><strong>Ejemplo</strong><span>{concept.example}</span></div>
            <div className="caution"><Icon name="alert" /><span><strong>Error a evitar:</strong> {concept.caution}</span></div>
          </article>
        ))}
      </div>
      {!filtered.length && <div className="empty-state"><Icon name="search" size={32} /><Heading level={3}>No encontramos ese concepto</Heading><p>Probá con otra palabra o categoría.</p></div>}
    </>
  );
}

function HistoryView({ saved, navigate }: { saved: SavedAnalysis[]; navigate: (section: Section) => void }) {
  return (
    <>
      <PageHeader actions={<Button onClick={() => navigate("diagnostico")}><Icon name="plus" /> Nuevo análisis</Button>} description="Consultá los análisis guardados localmente en este dispositivo." eyebrow="Tus registros" title="Historial de análisis" />
      <section className="card table-card">
        {saved.length ? <div className="table-scroll"><table><thead><tr><th>Análisis</th><th>Empresa</th><th>Fecha</th><th>Tipo</th><th>Período</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{saved.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.company}</td><td>{item.date}</td><td>{item.type}</td><td>{item.period}</td><td><span className="status status-positive">Completo</span></td><td><Button variant="ghost" onClick={() => navigate("informes")}>Abrir</Button></td></tr>)}</tbody></table></div> : <div className="empty-state"><Icon name="history" size={34} /><Heading level={3}>Todavía no guardaste análisis</Heading><p>Completá un diagnóstico para verlo acá.</p><Button onClick={() => navigate("diagnostico")}>Crear diagnóstico</Button></div>}
      </section>
      <div className="privacy-note"><Icon name="info" /><span>En esta MVP los análisis se guardan únicamente en el almacenamiento local del navegador. No se envían a servidores externos.</span></div>
    </>
  );
}

function Settings({ company, setCompany }: { company: string; setCompany: (value: string) => void }) {
  return (
    <>
      <PageHeader description="Personalizá la información general y revisá cómo se gestionan tus datos." eyebrow="Preferencias" title="Configuración" />
      <section className="card settings-card">
        <Heading level={3}>Perfil de la empresa</Heading>
        <div className="form-grid form-grid-2"><Field label="Nombre de la empresa"><Input value={company} onChange={(event) => setCompany(event.target.value)} /></Field><Field label="Moneda predeterminada"><Select defaultValue="ARS"><option value="ARS">Peso argentino ($ ARS)</option></Select></Field></div>
      </section>
      <section className="card settings-card"><Heading level={3}>Privacidad y alcance</Heading><div className="settings-list"><div><Icon name="check" /><span><strong>Almacenamiento local</strong>Los análisis guardados permanecen en este navegador.</span></div><div><Icon name="check" /><span><strong>Sin conexiones bancarias</strong>La MVP no accede a cuentas ni servicios financieros externos.</span></div><div><Icon name="check" /><span><strong>Cálculos transparentes</strong>Las fórmulas y limitaciones se muestran junto a los resultados.</span></div></div></section>
      <div className="method-note"><Icon name="info" /><p><strong>Meta de usabilidad a validar:</strong> que al menos 4 de cada 5 usuarios puedan completar un diagnóstico financiero básico sin asistencia. Esta es una meta del prototipo, no un resultado medido.</p></div>
    </>
  );
}

function CustomCharts({ data }: { data: FinancialData }) {
  const result = calculateFinancials(data);
  const templates = {
    resultados: [
      { label: "Ingresos", value: data.revenue },
      { label: "Costos", value: data.costs },
      { label: "Gastos", value: data.operatingExpenses },
      { label: "Resultado", value: result.netResult },
    ],
    patrimonio: [
      { label: "Activo corriente", value: data.currentAssets },
      { label: "Activo no corriente", value: data.nonCurrentAssets },
      { label: "Pasivo", value: result.totalLiabilities },
      { label: "Patrimonio", value: result.equity },
    ],
    evolucion: [
      { label: "PN inicial", value: data.openingEquity },
      { label: "Aportes", value: data.contributions - data.distributions },
      { label: "Resultado del período", value: result.netResult },
      { label: "PN al cierre", value: result.equityFromEvolution },
    ],
    flujo: [
      { label: "Actividades operativas", value: data.operatingCashFlow },
      { label: "Actividades de inversión", value: data.investingCashFlow },
      { label: "Actividades de financiación", value: data.financingCashFlow },
      { label: "Variación de efectivo", value: result.cashChange },
    ],
  };
  const [savedConfig] = useState<{
    title: string;
    chartType: "bars" | "line" | "donut";
    items: { label: string; value: number }[];
  } | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("ymc-custom-chart") ?? "null");
    } catch {
      return null;
    }
  });
  const [chartType, setChartType] = useState<"bars" | "line" | "donut">(savedConfig?.chartType ?? "bars");
  const [title, setTitle] = useState(savedConfig?.title ?? "Mi análisis personalizado");
  const [confirmed, setConfirmed] = useState(false);
  const [items, setItems] = useState(savedConfig?.items ?? templates.resultados);
  const positiveItems = items.map((item) => ({ ...item, value: Math.max(item.value, 0) }));
  const max = Math.max(...positiveItems.map((item) => item.value), 1);
  const total = positiveItems.reduce((sum, item) => sum + item.value, 0) || 1;
  const linePoints = positiveItems
    .map((item, index) => `${12 + index * 25},${84 - (item.value / max) * 66}`)
    .join(" ");
  let donutOffset = 0;

  const updateItem = (index: number, key: "label" | "value", value: string) => {
    const next = [...items];
    next[index] = {
      ...next[index],
      [key]: key === "value" ? Number(value) : value,
    };
    setItems(next);
    setConfirmed(false);
  };

  return (
    <>
      <PageHeader
        description="Elegí el formato, los conceptos y los valores para construir una visualización a medida."
        eyebrow="Espacio de trabajo"
        title="Creador de gráficos"
      />
      <div className="chart-builder-layout">
        <section className="card builder-controls">
          <div className="card-heading">
            <div><Heading level={3}>Configuración</Heading><p>Todos los cambios se reflejan en la vista previa.</p></div>
          </div>
          <div className="form-grid">
            <Field label="Título del gráfico"><Input value={title} onChange={(event) => { setTitle(event.target.value); setConfirmed(false); }} /></Field>
            <Field label="Tipo de gráfico">
              <Select value={chartType} onChange={(event) => { setChartType(event.target.value as "bars" | "line" | "donut"); setConfirmed(false); }}>
                <option value="bars">Barras comparativas</option>
                <option value="line">Línea de evolución</option>
                <option value="donut">Anillo de composición</option>
              </Select>
            </Field>
            <Field label="Plantilla de datos">
              <Select
                defaultValue="resultados"
                onChange={(event) => {
                  setItems(templates[event.target.value as keyof typeof templates]);
                  setConfirmed(false);
                }}
              >
                <option value="resultados">Estado de resultados</option>
                <option value="patrimonio">Estado de Situación Patrimonial</option>
                <option value="evolucion">Estado de Evolución del Patrimonio Neto</option>
                <option value="flujo">Estado de Flujo de Efectivo</option>
              </Select>
            </Field>
          </div>
          <div className="builder-values">
            <span>Series personalizadas</span>
            {items.map((item, index) => (
              <div key={index}>
                <Input aria-label={`Nombre de la serie ${index + 1}`} value={item.label} onChange={(event) => updateItem(index, "label", event.target.value)} />
                <Input aria-label={`Valor de la serie ${index + 1}`} type="number" value={item.value} onChange={(event) => updateItem(index, "value", event.target.value)} />
              </div>
            ))}
          </div>
          <Button onClick={() => {
            localStorage.setItem("ymc-custom-chart", JSON.stringify({ title, chartType, items }));
            setConfirmed(true);
          }}><Icon name="check" /> Guardar gráfico</Button>
          {confirmed && <span className="builder-success"><Icon name="check" /> El gráfico se guardó en este dispositivo.</span>}
        </section>
        <section className="card builder-preview">
          <div className="card-heading">
            <div><span className="eyebrow">Vista previa</span><Heading level={2}>{title || "Gráfico sin título"}</Heading></div>
            <span className="status status-neutral">Datos en $ ARS</span>
          </div>
          {chartType === "bars" && (
            <div className="custom-bars">
              {positiveItems.map((item, index) => (
                <div key={index}>
                  <div className="custom-bar-track"><i className={`custom-bar custom-tone-${index}`} style={{ height: `${Math.max((item.value / max) * 100, 2)}%` }} /></div>
                  <strong>{currency(item.value)}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          )}
          {chartType === "line" && (
            <div className="custom-line-chart">
              <svg aria-label={title} role="img" viewBox="0 0 100 100">
                {[20, 40, 60, 80].map((y) => <line className="grid-line" key={y} x1="8" x2="94" y1={y} y2={y} />)}
                <polyline className="chart-line line-blue" points={linePoints} />
                {positiveItems.map((item, index) => <circle className="custom-point" cx={12 + index * 25} cy={84 - (item.value / max) * 66} key={index} r="2" />)}
              </svg>
              <div>{positiveItems.map((item) => <span key={item.label}>{item.label}</span>)}</div>
            </div>
          )}
          {chartType === "donut" && (
            <div className="custom-donut-layout">
              <div className="donut-chart">
                <svg aria-label={title} role="img" viewBox="0 0 42 42">
                  <circle className="donut-base" cx="21" cy="21" fill="none" pathLength="100" r="15.9" />
                  {positiveItems.map((item, index) => {
                    const share = (item.value / total) * 100;
                    const currentOffset = donutOffset;
                    donutOffset -= share;
                    return <circle className={`donut-segment custom-stroke-${index}`} cx="21" cy="21" fill="none" key={index} pathLength="100" r="15.9" strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={currentOffset} />;
                  })}
                </svg>
                <div className="donut-center"><strong>{currency(total)}</strong><span>Total</span></div>
              </div>
              <div className="donut-legend">
                {positiveItems.map((item, index) => <div key={index}><i className={`legend-dot custom-bg-${index}`} /><span>{item.label}</span><strong>{percent(item.value / total)}</strong></div>)}
              </div>
            </div>
          )}
          <div className="builder-caption"><Icon name="info" /><span>Los valores son editables y no se interpretan como información real hasta que confirmes su origen.</span></div>
        </section>
      </div>
    </>
  );
}

function GlobalSearch({ navigate, placeholder = "Buscar una funcionalidad, concepto o indicador..." }: { navigate: (section: Section) => void; placeholder?: string }) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const searchable = [
    ...navigation.map((item) => ({ label: item.label, detail: "Funcionalidad", section: item.id, icon: item.icon })),
    ...concepts.map((item) => ({ label: item.term, detail: item.category, section: "biblioteca" as Section, icon: "book" })),
    { label: "Liquidez corriente", detail: "Indicador financiero", section: "diagnostico" as Section, icon: "chart" },
    { label: "Margen neto y rentabilidad", detail: "Indicador financiero", section: "diagnostico" as Section, icon: "chart" },
  ];
  const results = normalized
    ? searchable.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(normalized)).slice(0, 6)
    : [];
  const select = (section: Section) => {
    navigate(section);
    setQuery("");
  };
  return (
    <div className="global-search">
      <Icon name="search" />
      <Input
        aria-label="Buscar una funcionalidad, concepto o indicador"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results[0]) select(results[0].section);
        }}
      />
      {normalized && (
        <div className="search-results">
          {results.length ? results.map((item, index) => (
            <Button key={`${item.label}-${index}`} variant="ghost" onClick={() => select(item.section)}>
              <span className="search-result-icon"><Icon name={item.icon} /></span>
              <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              <Icon name="arrow" />
            </Button>
          )) : <div className="search-empty"><Icon name="search" /><span>No encontramos resultados para “{query}”.</span></div>}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="notification-wrap">
      <Button
        aria-expanded={open}
        aria-label="Ver notificaciones"
        className="notification-button"
        variant="ghost"
        onClick={() => setOpen(!open)}
      >
        <Icon name="bell" />
        <span className="notification-dot">3</span>
      </Button>
      {open && (
        <div className="notification-panel">
          <div className="notification-heading">
            <Heading level={3}>Notificaciones</Heading>
            <span>3 nuevas</span>
          </div>
          <div className="notification-item unread">
            <span className="notification-type positive"><Icon name="chart" /></span>
            <div><strong>Diagnóstico actualizado</strong><span>Tus indicadores ya están listos para revisar.</span><time>Hace 5 min</time></div>
          </div>
          <div className="notification-item unread">
            <span className="notification-type warning"><Icon name="alert" /></span>
            <div><strong>Vencimiento próximo</strong><span>Una cuota de financiamiento vence en 7 días.</span><time>Hace 2 h</time></div>
          </div>
          <div className="notification-item">
            <span className="notification-type info"><Icon name="report" /></span>
            <div><strong>Informe disponible</strong><span>El informe financiero puede descargarse en PDF.</span><time>Ayer</time></div>
          </div>
          <Button variant="ghost" onClick={() => setOpen(false)}>Marcar todas como leídas</Button>
        </div>
      )}
    </div>
  );
}

// Market dashboards show their title in the top bar, like an "Overview" header.
const topbarTitles: Partial<Record<Section, string>> = {
  dashboard: "Panorama de mercado",
  datos: "GPR Index",
  diagnostico: "Sentiment Analysis",
};

function UserMenu({ navigate }: { navigate: (section: Section) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  const go = (section: Section) => {
    setOpen(false);
    navigate(section);
  };
  return (
    <div className="user-menu" ref={menuRef}>
      <Button aria-expanded={open} aria-haspopup="menu" aria-label="Cuenta de Juan Cortez" className="user-menu-trigger" variant="ghost" onClick={() => setOpen(!open)}>
        <span className="avatar">JC</span>
        <span className="user-menu-name">Juan Cortez</span>
        <svg aria-hidden="true" className="user-menu-caret" height="5" viewBox="0 0 8 5" width="8"><path d="M0 0h8L4 5Z" fill="currentColor" /></svg>
      </Button>
      {open && (
        <div aria-label="Cuenta" className="user-menu-panel" role="menu">
          <Button role="menuitem" variant="ghost" onClick={() => go("configuracion")}><Icon name="settings" size={16} />Configuración</Button>
          <Button role="menuitem" variant="ghost" onClick={() => go("historial")}><Icon name="history" size={16} />Historial</Button>
        </div>
      )}
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo ${compact ? "compact" : ""}`}>
      <Image
        alt="IB1 · Investment Business One"
        className="brand-reference"
        src={ib1Logo}
        width={74}
        height={74}
        unoptimized
      />
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState<Section>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Las tres secciones principales comparten el formato móvil del GPR Index:
  // barra de marca, buscador y pestañas inferiores.
  const isMobilePrimary =
    active === "dashboard" || active === "datos" || active === "diagnostico";
  const gprMobile = isMobilePrimary && mobileViewport;
  const topbarTitle = topbarTitles[active];
  const [company, setCompany] = useState("Estudio Norte SRL");
  const [period, setPeriod] = useState("2025");
  const [data, setData] = useState<FinancialData>(demoFinancials);
  const [isDemo, setIsDemo] = useState(true);
  const [toast, setToast] = useState("");
  const [saved, setSaved] = useState<SavedAnalysis[]>([]);
  const [documents, setDocuments] = useState<ImportedDocument[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setMobileViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!gprMobile || !menuOpen || !sidebarRef.current) return;
    const sidebar = sidebarRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
      }
      if (event.key !== "Tab") return;
      const buttons = [...sidebar.querySelectorAll<HTMLButtonElement>("button")];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      const trigger = sidebar.parentElement?.querySelector<HTMLButtonElement>(
        '.mobile-bar [aria-label="Abrir menú"]',
      );
      (trigger ?? contentRef.current)?.focus();
    };
  }, [gprMobile, menuOpen]);
  useEffect(() => {
    try {
      const storedAnalyses = JSON.parse(localStorage.getItem("ymc-analyses") ?? "[]");
      const storedDocuments = JSON.parse(localStorage.getItem("ymc-imported-documents") ?? "[]");
      if (Array.isArray(storedAnalyses)) setSaved(storedAnalyses);
      if (Array.isArray(storedDocuments)) setDocuments(storedDocuments);
    } catch {
      // Keep browser-only financial records private and tolerate unavailable storage.
    }
    setStorageReady(true);
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem("ymc-analyses", JSON.stringify(saved)); } catch {}
  }, [saved, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem("ymc-imported-documents", JSON.stringify(documents)); } catch {}
  }, [documents, storageReady]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = (section: Section) => {
    setActive(section);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const save = () => {
    const result = calculateFinancials(data);
    const item: SavedAnalysis = {
      id: Date.now(),
      name: `Diagnóstico ${new Intl.DateTimeFormat("es-AR", { month: "short", year: "numeric" }).format(new Date())}`,
      company: company || "Sin identificar",
      date: new Intl.DateTimeFormat("es-AR").format(new Date()),
      type: "Diagnóstico",
      period,
      result: result.netResult,
    };
    setSaved([item, ...saved]);
    setToast("El análisis se guardó correctamente.");
  };

  const view = useMemo(() => {
    if (active === "dashboard") return <MarketDashboard navigate={navigate} />;
    if (active === "datos") return <GPRDashboard />;
    if (active === "diagnostico") return <SentimentDashboard />;
    if (active === "financiamiento") return <Financing />;
    if (active === "proyectos") return <Projects />;
    if (active === "escenarios") return <Scenarios data={data} />;
    if (active === "graficos") return <CustomCharts data={data} />;
    if (active === "informes") return <Reports company={company} data={data} documents={documents} period={period} />;
    if (active === "biblioteca") return <Library />;
    if (active === "historial") return <HistoryView navigate={navigate} saved={saved} />;
    return <Settings company={company} setCompany={setCompany} />;
  }, [active, company, data, documents, isDemo, period, saved]);

  return (
    <div className={`app-shell${isMobilePrimary ? " gpr-mobile-shell" : ""}${isMobilePrimary && active !== "datos" ? " mobile-compact" : ""}`}>
      <aside id="app-navigation" ref={sidebarRef} className={`sidebar ${menuOpen ? "open" : ""}`} inert={gprMobile && !menuOpen} role={gprMobile && menuOpen ? "dialog" : undefined} aria-modal={gprMobile && menuOpen ? true : undefined} aria-label={gprMobile && menuOpen ? "Navegación principal" : undefined}>
        <div className="sidebar-top"><div className="logo sidebar-brand"><Image alt="" className="sidebar-brand-mark" src={ib1Logo} width={48} height={48} loading="eager" unoptimized /><span className="sidebar-brand-name"><small>Investment Business One</small></span></div></div>
        <nav aria-label="Navegación principal">
          <span className="nav-label">ANALISIS DE MERCADO</span>
          {navigation.slice(0, 8).filter((item) => !["escenarios", "graficos", "informes"].includes(item.id)).map((item) => <Button className={active === item.id ? "active" : ""} key={item.id} variant="ghost" onClick={() => navigate(item.id)}><Icon name={item.icon} /><span>{item.label}</span></Button>)}
          <span className="nav-label secondary">RECURSOS</span>
          {navigation.slice(8).map((item) => <Button className={active === item.id ? "active" : ""} key={item.id} variant="ghost" onClick={() => navigate(item.id)}><Icon name={item.icon} /><span>{item.label}</span></Button>)}
        </nav>
      </aside>
      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
      <main inert={gprMobile && menuOpen}>
        <div className="mobile-bar">
          {isMobilePrimary ? (
            <>
              <div className="logo gpr-mobile-brand">
                <Image alt="" className="sidebar-brand-mark" src={ib1Logo} width={48} height={48} loading="eager" unoptimized />
                <span>Investment Business One</span>
              </div>
              <div className="mobile-user-actions">
                <NotificationBell />
                <span className="avatar">JC</span>
                <Button aria-label="Abrir menú" aria-expanded={menuOpen} aria-controls="app-navigation" variant="ghost" onClick={() => setMenuOpen(true)}><Icon name="menu" /></Button>
              </div>
            </>
          ) : (
            <><Button aria-label="Abrir menú" variant="ghost" onClick={() => setMenuOpen(true)}><Icon name="menu" /></Button><Logo compact /><div className="mobile-user-actions"><NotificationBell /><span className="avatar">JC</span></div></>
          )}
        </div>
        {topbarTitle ? (
          <div className="desktop-topbar topbar-overview">
            <Heading level={1} className="topbar-title">{topbarTitle}</Heading>
            <GlobalSearch navigate={navigate} placeholder="Buscar" />
            <div className="topbar-user">
              <NotificationBell />
              <UserMenu navigate={navigate} />
            </div>
          </div>
        ) : (
          <div className="desktop-topbar">
            <GlobalSearch navigate={navigate} />
            <div className="topbar-user">
              <NotificationBell />
              <span className="avatar">JC</span>
              <div><strong>Juan Cortez</strong></div>
            </div>
          </div>
        )}
        <div className={`content${topbarTitle ? " content-compact" : ""}${isMobilePrimary ? ` content-${active}` : ""}${active === "dashboard" && !mobileViewport ? " max-[860px]:px-4! max-[860px]:py-5! sm:max-[860px]:px-6!" : ""}`} ref={contentRef} tabIndex={-1}>
          {isMobilePrimary && <div className="gpr-mobile-search"><GlobalSearch navigate={navigate} /></div>}
          {view}
        </div>
      </main>
      {isMobilePrimary && (
        <nav className="gpr-mobile-tabs" aria-label="ANALISIS DE MERCADO" inert={gprMobile && menuOpen}>
          {navigation.slice(0, 3).map((item) => (
            <Button key={item.id} variant="ghost" aria-current={active === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Button>
          ))}
        </nav>
      )}
      {toast && <div className="toast" role="status"><Icon name="check" />{toast}</div>}
    </div>
  );
}

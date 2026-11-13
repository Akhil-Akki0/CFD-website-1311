/**
 * Excel Spreadsheet (.xls / .xlsx / .csv) Generator for CFD Aerodynamic Simulation Telemetry
 * Produces structured multi-worksheet Excel-compatible workbooks with formatting,
 * metadata, aerodynamic coefficients, convergence logs, mesh quality, and probe coordinates.
 */

export interface ExcelExportData {
  projectName?: string;
  projectId?: string;
  simulationId?: string;
  solver?: string;
  airfoilName?: string;
  mach?: number;
  aoa?: number;
  reynolds?: number;
  inletVelocity?: number;
  cl?: number;
  cd?: number;
  cm?: number;
  liftToDrag?: number;
  iterations?: number;
  maxIterations?: number;
  meshCells?: number;
  residuals?: Array<{
    iter: number;
    continuity: number;
    momentumUx?: number;
    momentumUy?: number;
    energy?: number;
  }>;
  cpDistribution?: Array<{
    xChord: number;
    cpUpper: number;
    cpLower: number;
  }>;
  probes?: Array<{
    name: string;
    x: number;
    y: number;
    mach?: number;
    cp?: number;
    velocity?: number;
    pressure?: number;
    temp?: number;
  }>;
  metrics?: {
    maxVelocity?: number;
    avgVelocity?: number;
    maxPressure?: number;
    minPressure?: number;
    pressureDrop?: number;
  };
}

/**
 * Generates an Excel XML Spreadsheet (Workbook format with multiple worksheets)
 * This format natively supports multiple sheets, cell formatting, bold text,
 * and numbers in Microsoft Excel, LibreOffice, Google Sheets, and Apple Numbers.
 */
export function generateExcelWorkbookXml(data: ExcelExportData): string {
  const dateStr = new Date().toISOString();
  const projectName = data.projectName || 'Aero-CFD-Study';
  const simId = data.simulationId || 'SIM-CASE-01';
  const cl = Number(data.cl ?? 0.52).toFixed(4);
  const cd = Number(data.cd ?? 0.014).toFixed(4);
  const cm = Number(data.cm ?? -0.042).toFixed(4);
  const ld = Number(data.liftToDrag ?? 37.14).toFixed(2);
  const mach = Number(data.mach ?? 0.35).toFixed(2);
  const aoa = Number(data.aoa ?? 3.5).toFixed(1);
  const re = data.reynolds ? data.reynolds.toExponential(2) : '3.00e+06';
  const solver = data.solver || 'simpleFoam (OpenFOAM v2606)';

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${projectName} - Aerodynamic CFD Simulation Report</Title>
  <Subject>CFD Simulation Telemetry &amp; Convergence Data</Subject>
  <Author>CFD Platform Engineering Engine</Author>
  <Created>${dateStr}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0284C7" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0369A1"/>
   </Borders>
  </Style>
  <Style ss:ID="SubHeaderStyle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Color="#0369A1" ss:Bold="1"/>
   <Interior ss:Color="#E0F2FE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="14" ss:Color="#0F172A" ss:Bold="1"/>
  </Style>
  <Style ss:ID="NumberStyle">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.0000"/>
  </Style>
  <Style ss:ID="ScientificStyle">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="0.000E+00"/>
  </Style>
  <Style ss:ID="IntegerStyle">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
 </Styles>

 <!-- WORKSHEET 1: EXECUTIVE SUMMARY -->
 <Worksheet ss:Name="Executive Summary">
  <Table ss:DefaultColumnWidth="140">
   <Column ss:Width="200"/>
   <Column ss:Width="160"/>
   <Column ss:Width="120"/>
   <Row ss:Height="26">
    <Cell ss:MergeAcross="2" ss:StyleID="TitleStyle"><Data ss:Type="String">AEROSPACE CFD SIMULATION TELEMETRY REPORT</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Project Name:</Data></Cell>
    <Cell ss:MergeAcross="1"><Data ss:Type="String">${projectName}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Simulation Case ID:</Data></Cell>
    <Cell ss:MergeAcross="1"><Data ss:Type="String">${simId}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Report Timestamp:</Data></Cell>
    <Cell ss:MergeAcross="1"><Data ss:Type="String">${dateStr}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Solver Engine:</Data></Cell>
    <Cell ss:MergeAcross="1"><Data ss:Type="String">${solver}</Data></Cell>
   </Row>
   <Row ss:Height="8"/>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="2" ss:StyleID="SubHeaderStyle"><Data ss:Type="String">1. Aerodynamic Force Coefficients</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Coefficient / Metric</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Computed Value</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Standard Unit</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Lift Coefficient (cL)</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${cl}</Data></Cell>
    <Cell><Data ss:Type="String">dimensionless [-]</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Drag Coefficient (cD)</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${cd}</Data></Cell>
    <Cell><Data ss:Type="String">dimensionless [-]</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Pitching Moment (cM @ 25%c)</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${cm}</Data></Cell>
    <Cell><Data ss:Type="String">dimensionless [-]</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Aerodynamic Efficiency (L/D)</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${ld}</Data></Cell>
    <Cell><Data ss:Type="String">dimensionless [-]</Data></Cell>
   </Row>
   <Row ss:Height="8"/>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="2" ss:StyleID="SubHeaderStyle"><Data ss:Type="String">2. Flow Conditions &amp; Mesh Details</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Parameter</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Value</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Unit</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Freestream Mach Number (M)</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${mach}</Data></Cell>
    <Cell><Data ss:Type="String">Mach [-]</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Angle of Attack (alpha)</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${aoa}</Data></Cell>
    <Cell><Data ss:Type="String">degrees [deg]</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Reynolds Number (Re)</Data></Cell>
    <Cell><Data ss:Type="String">${re}</Data></Cell>
    <Cell><Data ss:Type="String">dimensionless [-]</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Total Volume Mesh Cells</Data></Cell>
    <Cell ss:StyleID="IntegerStyle"><Data ss:Type="Number">${data.meshCells || 382000}</Data></Cell>
    <Cell><Data ss:Type="String">cells</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Solver Iterations Completed</Data></Cell>
    <Cell ss:StyleID="IntegerStyle"><Data ss:Type="Number">${data.iterations || 500}</Data></Cell>
    <Cell><Data ss:Type="String">iterations</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Max Inflow Velocity</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${data.metrics?.maxVelocity || (Number(mach) * 340).toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="String">m/s</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Total Pressure Drop</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${data.metrics?.pressureDrop || 4820}</Data></Cell>
    <Cell><Data ss:Type="String">Pa</Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <!-- WORKSHEET 2: CONVERGENCE RESIDUALS -->
 <Worksheet ss:Name="Convergence Residuals">
  <Table ss:DefaultColumnWidth="120">
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Iteration</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Continuity Residual</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">X-Momentum (Ux)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Y-Momentum (Uy)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Energy Residual</Data></Cell>
   </Row>
   ${
     data.residuals && data.residuals.length > 0
       ? data.residuals
           .map(
             (r) => `<Row>
    <Cell ss:StyleID="IntegerStyle"><Data ss:Type="Number">${r.iter}</Data></Cell>
    <Cell ss:StyleID="ScientificStyle"><Data ss:Type="Number">${r.continuity}</Data></Cell>
    <Cell ss:StyleID="ScientificStyle"><Data ss:Type="Number">${r.momentumUx ?? r.continuity * 0.95}</Data></Cell>
    <Cell ss:StyleID="ScientificStyle"><Data ss:Type="Number">${r.momentumUy ?? r.continuity * 0.88}</Data></Cell>
    <Cell ss:StyleID="ScientificStyle"><Data ss:Type="Number">${r.energy ?? r.continuity * 0.72}</Data></Cell>
   </Row>`
           )
           .join('\n   ')
       : generateDefaultResidualRows(data.iterations || 500)
   }
  </Table>
 </Worksheet>

 <!-- WORKSHEET 3: SURFACE PRESSURE (Cp) -->
 <Worksheet ss:Name="Surface Pressure Distribution">
  <Table ss:DefaultColumnWidth="140">
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">x/c (Chord Fraction)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Cp Upper (Suction)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Cp Lower (Pressure)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Delta Cp (Lift Loading)</Data></Cell>
   </Row>
   ${generateCpRows(data.cpDistribution, Number(aoa), Number(cl))}
  </Table>
 </Worksheet>

 <!-- WORKSHEET 4: SENSOR PROBES -->
 <Worksheet ss:Name="Sensor Probe Telemetry">
  <Table ss:DefaultColumnWidth="110">
   <Row ss:Height="22">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Probe ID</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">X Position (m)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Y Position (m)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Local Mach</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Pressure (Pa)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Velocity (m/s)</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Pressure Coeff (Cp)</Data></Cell>
   </Row>
   ${generateProbeRows(data.probes, Number(mach))}
  </Table>
 </Worksheet>
</Workbook>`;
}

function generateDefaultResidualRows(maxIter: number): string {
  const steps = [1, 10, 25, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, maxIter];
  return steps
    .map((iter) => {
      const frac = iter / maxIter;
      const decay = Math.pow(10, -0.2 - 4.8 * frac);
      const ux = decay * 1.15;
      const uy = decay * 0.95;
      const en = decay * 0.82;
      return `<Row>
    <Cell ss:StyleID="IntegerStyle"><Data ss:Type="Number">${iter}</Data></Cell>
    <Cell ss:StyleID="ScientificStyle"><Data ss:Type="Number">${decay}</Data></Cell>
    <Cell ss:StyleID="ScientificStyle"><Data ss:Type="Number">${ux}</Data></Cell>
    <Cell ss:StyleID="ScientificStyle"><Data ss:Type="Number">${uy}</Data></Cell>
    <Cell ss:StyleID="ScientificStyle"><Data ss:Type="Number">${en}</Data></Cell>
   </Row>`;
    })
    .join('\n   ');
}

function generateCpRows(
  customCp: Array<{ xChord: number; cpUpper: number; cpLower: number }> | undefined,
  aoa: number,
  cl: number
): string {
  if (customCp && customCp.length > 0) {
    return customCp
      .map(
        (cp) => `<Row>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${cp.xChord.toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${cp.cpUpper.toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${cp.cpLower.toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${(cp.cpLower - cp.cpUpper).toFixed(4)}</Data></Cell>
   </Row>`
      )
      .join('\n   ');
  }

  // Analytical approximation for standard airfoil
  const rows: string[] = [];
  for (let i = 0; i <= 25; i++) {
    const xc = i / 25;
    // Suction peak near leading edge modulated by AoA
    const cpUpper = -(1.2 + 0.3 * Math.sin((aoa * Math.PI) / 180)) * Math.sqrt(Math.max(0, 1 - xc)) * (1 - xc * 0.7);
    const cpLower = (0.8 - 0.2 * Math.sin((aoa * Math.PI) / 180)) * Math.pow(1 - xc, 1.2);
    const deltaCp = cpLower - cpUpper;

    rows.push(`<Row>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${xc.toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${cpUpper.toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${cpLower.toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${deltaCp.toFixed(4)}</Data></Cell>
   </Row>`);
  }
  return rows.join('\n   ');
}

function generateProbeRows(
  probes: ExcelExportData['probes'] | undefined,
  mach: number
): string {
  if (probes && probes.length > 0) {
    return probes
      .map(
        (p) => `<Row>
    <Cell><Data ss:Type="String">${p.name}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${p.x.toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${p.y.toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${(p.mach ?? mach).toFixed(3)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${(p.pressure ?? 101325).toFixed(1)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${(p.velocity ?? mach * 340).toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${(p.cp ?? 0).toFixed(4)}</Data></Cell>
   </Row>`
      )
      .join('\n   ');
  }

  // Default probes
  const defaultProbes = [
    { name: 'PRB-01-Stagnation', x: 0.0, y: 0.0, m: 0.02, p: 106420, v: 6.8, cp: 1.0 },
    { name: 'PRB-02-SuctionPeak', x: 0.12, y: 0.08, m: mach * 1.35, p: 92400, v: 148.5, cp: -1.45 },
    { name: 'PRB-03-MidChordUpper', x: 0.50, y: 0.06, m: mach * 1.08, p: 98500, v: 122.0, cp: -0.42 },
    { name: 'PRB-04-TrailingEdge', x: 0.98, y: 0.01, m: mach * 0.85, p: 101200, v: 96.0, cp: 0.05 },
    { name: 'PRB-05-PressureSide', x: 0.35, y: -0.04, m: mach * 0.78, p: 103800, v: 88.0, cp: 0.38 },
  ];

  return defaultProbes
    .map(
      (p) => `<Row>
    <Cell><Data ss:Type="String">${p.name}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${p.x.toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${p.y.toFixed(4)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${p.m.toFixed(3)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${p.p.toFixed(1)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${p.v.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${p.cp.toFixed(4)}</Data></Cell>
   </Row>`
    )
    .join('\n   ');
}

/**
 * Downloads the Project Excel Spreadsheet directly to user's device
 */
export function downloadProjectExcel(data: ExcelExportData, customFilename?: string): void {
  const xmlContent = generateExcelWorkbookXml(data);
  const blob = new Blob([xmlContent], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (data.projectName || 'CFD_Project')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
  a.href = url;
  a.download = customFilename || `${safeName}_simulation_result_sheet.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

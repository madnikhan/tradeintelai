/**
 * Chart Capture Utility
 * Converts chart components to base64 images for vision analysis
 */

/**
 * Capture chart element as base64 image
 */
export async function captureChartAsImage(
  elementId: string,
  options: {
    width?: number;
    height?: number;
    format?: 'png' | 'jpeg';
    quality?: number;
  } = {}
): Promise<string | null> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Chart element with id "${elementId}" not found`);
      return null;
    }

    // Use html2canvas if available, otherwise fallback to canvas
    const { default: html2canvas } = await import('html2canvas');
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#0d1321',
      scale: 2, // Higher quality
      logging: false,
      useCORS: true,
      width: options.width || element.clientWidth,
      height: options.height || element.clientHeight,
    });

    const format = options.format || 'png';
    const quality = options.quality || 0.95;
    
    return canvas.toDataURL(`image/${format}`, quality).split(',')[1]; // Remove data:image/png;base64, prefix
  } catch (error) {
    console.error('Failed to capture chart:', error);
    return null;
  }
}

/**
 * Capture Recharts chart as image
 * Enhanced to properly capture SVG elements and verify chart data is rendered
 */
export async function captureRechartsChart(
  containerId: string,
  chartSelector: string = '.recharts-wrapper'
): Promise<string | null> {
  try {
    // Try multiple times with increasing delays
    // Longer delays needed for Recharts SVG rendering
    const maxRetries = 5;
    const delays = [1000, 2000, 3000, 4000, 5000];
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const container = document.getElementById(containerId);
      if (!container) {
        if (attempt === maxRetries - 1) {
          console.error(`❌ Container with id "${containerId}" not found after ${maxRetries} attempts`);
          throw new Error(`Chart container "${containerId}" not found. Make sure the chart is rendered.`);
        }
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        continue;
      }

      // Wait longer for chart to be fully rendered with data
      // Recharts needs time to render SVG elements, especially the data line
      const waitTime = Math.max(1000, delays[attempt] * 2);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      let chartElement = container.querySelector(chartSelector) as HTMLElement;
      
      // Fallback: if chart element not found on last attempt, try to capture the container itself
      if (!chartElement) {
        if (attempt === maxRetries - 1) {
          console.warn(`Chart element "${chartSelector}" not found, trying to capture container instead`);
          chartElement = container as HTMLElement;
        } else {
          // Retry on next attempt
          continue;
        }
      }

      // Check if chart has dimensions
      const width = chartElement.offsetWidth || chartElement.clientWidth;
      const height = chartElement.offsetHeight || chartElement.clientHeight;
      
      if (width === 0 || height === 0) {
        if (attempt === maxRetries - 1) {
          console.error(`❌ Chart element has no dimensions (${width}x${height}) after ${maxRetries} attempts`);
          throw new Error(`Chart has no dimensions (${width}x${height}). The chart may not be fully rendered.`);
        }
        continue;
      }

      // Verify chart has actual data rendered (check for SVG paths/lines)
      const svgElement = chartElement.querySelector('svg');
      if (!svgElement) {
        if (attempt < maxRetries - 1) {
          console.warn(`Chart SVG not found, retrying... (attempt ${attempt + 1}/${maxRetries})`);
          continue;
        }
      }
      
      // Check for actual chart line/path elements (not just axes)
      // Recharts uses various selectors for the line - check multiple possibilities
      const chartPaths = chartElement.querySelectorAll(
        'svg path.recharts-curve, ' +
        'svg path.recharts-line-curve, ' +
        'svg path[stroke="#06b6d4"], ' +
        'svg path[stroke="#06b6d4"][stroke-width="2"], ' +
        'svg path[stroke-width="2"]'
      );
      
      // Also check for any path with significant length (actual chart line, not just axis)
      let hasChartLine = chartPaths.length > 0;
      if (!hasChartLine && svgElement) {
        // Check all paths and see if any have a significant path length (actual line, not just axis)
        const allPaths = svgElement.querySelectorAll('path');
        for (const path of Array.from(allPaths)) {
          const d = path.getAttribute('d');
          if (d && d.length > 50) { // Chart lines have longer path data than axis lines
            hasChartLine = true;
            break;
          }
        }
      }
      
      if (!hasChartLine && attempt < maxRetries - 1) {
        console.warn(`Chart line not rendered yet, retrying... (attempt ${attempt + 1}/${maxRetries})`);
        continue;
      }
      
      if (!hasChartLine && attempt === maxRetries - 1) {
        console.warn(`⚠️ Chart line not found after ${maxRetries} attempts - chart may not have data, but will attempt capture anyway`);
      }

      // Try to capture with html2canvas
      try {
        const { default: html2canvas } = await import('html2canvas');
        
        const canvas = await html2canvas(chartElement, {
          backgroundColor: '#0d1321',
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
          width: width,
          height: height,
          windowWidth: width,
          windowHeight: height,
          // Ensure SVG elements are captured properly
          onclone: (clonedDoc) => {
            // Force SVG rendering in cloned document
            const clonedElement = clonedDoc.getElementById(containerId);
            if (clonedElement) {
              const clonedChart = clonedElement.querySelector(chartSelector) as HTMLElement;
              if (clonedChart) {
                // Ensure SVG is visible and properly rendered
                const svgs = clonedChart.querySelectorAll('svg');
                svgs.forEach(svg => {
                  svg.style.visibility = 'visible';
                  svg.style.display = 'block';
                  svg.style.opacity = '1';
                  // Force SVG to render all paths
                  const paths = svg.querySelectorAll('path, line, polyline');
                  paths.forEach(path => {
                    (path as SVGElement).style.visibility = 'visible';
                    (path as SVGElement).style.display = 'block';
                    (path as SVGElement).style.opacity = '1';
                  });
                });
              }
            }
          },
        });

        if (!canvas || canvas.width === 0 || canvas.height === 0) {
          throw new Error('Canvas has no dimensions');
        }

        const base64 = canvas.toDataURL('image/png', 0.95);
        if (!base64 || base64.length < 100) {
          throw new Error('Generated base64 image is too small or invalid');
        }

        // Debug: Log what was captured
        console.log(`✅ Chart captured successfully:`);
        console.log(`   Size: ${Math.round(base64.length / 1024)}KB`);
        console.log(`   Dimensions: ${canvas.width}x${canvas.height}px`);
        console.log(`   Chart line detected: ${hasChartLine}`);
        console.log(`   SVG paths found: ${chartPaths.length}`);
        
        return base64.split(',')[1]; // Remove data:image/png;base64, prefix
      } catch (canvasError: any) {
        if (attempt === maxRetries - 1) {
          console.error('❌ html2canvas failed:', canvasError);
          throw new Error(`Failed to capture chart: ${canvasError.message || 'Unknown error'}`);
        }
        // Retry with next delay
        continue;
      }
    }

    throw new Error('Failed to capture chart after all retry attempts');
  } catch (error: any) {
    console.error('❌ Failed to capture Recharts chart:', error);
    throw error; // Re-throw to let caller handle it
  }
}

/**
 * Capture canvas element directly
 */
export function captureCanvasAsImage(
  canvasId: string,
  format: 'png' | 'jpeg' = 'png',
  quality: number = 0.95
): string | null {
  try {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      console.error(`Canvas with id "${canvasId}" not found`);
      return null;
    }

    return canvas.toDataURL(`image/${format}`, quality).split(',')[1];
  } catch (error) {
    console.error('Failed to capture canvas:', error);
    return null;
  }
}

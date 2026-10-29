export interface TimetableExportOptions {
  slots: any[];
  entityTitle: string; // e.g. "Section BSIT 1A" or "Prof. Smith" or "Room 204"
  termName?: string;
  departmentName?: string;
}

const DAYS = [
  { code: 'MON', label: 'Monday' },
  { code: 'TUE', label: 'Tuesday' },
  { code: 'WED', label: 'Wednesday' },
  { code: 'THU', label: 'Thursday' },
  { code: 'FRI', label: 'Friday' },
  { code: 'SAT', label: 'Saturday' },
];

const TIME_WINDOWS = [
  { start: '07:30', end: '08:30', label: '07:30 - 08:30' },
  { start: '08:30', end: '09:30', label: '08:30 - 09:30' },
  { start: '09:30', end: '10:30', label: '09:30 - 10:30' },
  { start: '10:30', end: '11:30', label: '10:30 - 11:30' },
  { start: '11:30', end: '12:00', label: '11:30 - 12:00' },
  { start: '12:00', end: '13:00', label: '12:00 - 01:00 (LUNCH)', isLunch: true },
  { start: '13:00', end: '14:00', label: '01:00 - 02:00' },
  { start: '14:00', end: '15:00', label: '02:00 - 03:00' },
  { start: '15:00', end: '16:00', label: '03:00 - 04:00' },
  { start: '16:00', end: '17:00', label: '04:00 - 05:00' },
  { start: '17:00', end: '18:00', label: '05:00 - 06:00' },
  { start: '18:00', end: '19:00', label: '06:00 - 07:00' },
];

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function doesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return Math.max(timeToMinutes(s1), timeToMinutes(s2)) < Math.min(timeToMinutes(e1), timeToMinutes(e2));
}

/**
 * Generates an Excel-compatible (.xls) spreadsheet representing the weekly timetable matrix.
 * Opens natively in Microsoft Excel, Google Sheets, and LibreOffice Calc with formatted colors and borders.
 */
export function exportTimetableToExcel({
  slots,
  entityTitle,
  termName = 'Academic Term',
  departmentName = 'College Academic Timetable',
}: TimetableExportOptions) {
  let tableRows = '';

  // Main Header Banners
  tableRows += `
    <tr>
      <th colspan="7" style="background-color: #1e1b4b; color: #ffffff; font-size: 16px; font-weight: bold; text-align: center; padding: 14px;">
        ${departmentName.toUpperCase()}
      </th>
    </tr>
    <tr>
      <th colspan="7" style="background-color: #3730a3; color: #ffffff; font-size: 13px; font-weight: bold; text-align: center; padding: 8px;">
        ${entityTitle.toUpperCase()} • ${termName}
      </th>
    </tr>
    <tr style="background-color: #f1f5f9;">
      <th style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; text-align: center; width: 140px;">TIME SLOT</th>
      ${DAYS.map(
        (d) =>
          `<th style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; text-align: center; width: 170px;">${d.label.toUpperCase()}</th>`
      ).join('')}
    </tr>
  `;

  // Pre-calculate covered cells for multi-hour blocks (e.g. 3h Laboratory)
  const coveredUntil: Record<string, number> = {};
  DAYS.forEach((d) => { coveredUntil[d.code] = -1; });

  // Rows by Time Window
  TIME_WINDOWS.forEach((win, wIdx) => {
    let rowCells = `<td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; text-align: center; background-color: #f8fafc; font-size: 11px;">${win.label}</td>`;

    if (win.isLunch) {
      rowCells += `<td colspan="6" style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; background-color: #fef3c7; color: #92400e; font-weight: bold; font-size: 11px; letter-spacing: 1px;">-- UNIVERSAL LUNCH BREAK --</td>`;
    } else {
      DAYS.forEach((day) => {
        // Skip cell if covered by an earlier row's rowspan
        if (coveredUntil[day.code] >= wIdx) {
          return;
        }

        // Find occupying slot(s) for this day and time
        const occupyingSlots = slots.filter(
          (s) => s.day_of_week === day.code && doesOverlap(s.start_time, s.end_time, win.start, win.end)
        );

        if (occupyingSlots.length > 0) {
          const slot = occupyingSlots[0];
          
          // Calculate span across consecutive non-lunch windows
          let span = 1;
          for (let nextWIdx = wIdx + 1; nextWIdx < TIME_WINDOWS.length; nextWIdx++) {
            const nextWin = TIME_WINDOWS[nextWIdx];
            if (nextWin.isLunch) break;
            if (doesOverlap(slot.start_time, slot.end_time, nextWin.start, nextWin.end)) {
              span++;
            } else {
              break;
            }
          }

          if (span > 1) {
            coveredUntil[day.code] = wIdx + span - 1;
          }

          const courseCode = slot.is_custom
            ? slot.custom_title || 'Custom Activity'
            : slot.section_subject?.course?.code || 'Course';
          const isAsync = !slot.is_custom && (!slot.room || slot.is_async);
          const isLab = !slot.is_custom && !isAsync && (slot.room?.room_type === 'LABORATORY' || slot.section_subject?.course?.has_lab);
          const type = slot.is_custom ? 'Custom' : isAsync ? 'Async' : isLab ? `Lab (${span}h)` : 'Lec';
          const section = slot.section_subject?.section?.name ? `Sec ${slot.section_subject.section.name}` : '';
          const room = slot.is_custom
            ? (slot.room ? `Rm ${slot.room.room_number}` : 'Custom')
            : isAsync
            ? 'Online / Async'
            : (slot.room ? `Rm ${slot.room.room_number}` : 'TBA');
          const professor = slot.section_subject?.professor
            ? `${slot.section_subject.professor.first_name?.[0] || ''}. ${slot.section_subject.professor.last_name}`
            : 'TBA';

          const bgColor = isLab ? '#fef3c7' : isAsync ? '#f3e8ff' : '#e0e7ff';
          const borderColor = isLab ? '#f59e0b' : isAsync ? '#a855f7' : '#6366f1';
          const textColor = isLab ? '#78350f' : isAsync ? '#581c87' : '#1e1b4b';

          rowCells += `
            <td rowspan="${span}" style="border: 2px solid ${borderColor}; padding: 10px; text-align: center; background-color: ${bgColor}; color: ${textColor}; vertical-align: middle;">
              <div style="font-weight: bold; font-size: 13px;">${courseCode} (${type})</div>
              <div style="font-size: 10px; margin-top: 3px;">${slot.start_time?.substring(0, 5)} - ${slot.end_time?.substring(0, 5)}</div>
              <div style="font-size: 11px; font-weight: bold; margin-top: 3px;">${section ? `${section} • ` : ''}${room}</div>
              <div style="font-size: 10px; color: #475569; margin-top: 2px;">${professor}</div>
            </td>
          `;
        } else {
          rowCells += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; background-color: #ffffff; color: #cbd5e1; font-size: 10px;">-</td>`;
        }
      });
    }

    tableRows += `<tr>${rowCells}</tr>`;
  });

  // Footer Row
  tableRows += `
    <tr>
      <td colspan="7" style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; background-color: #f8fafc; font-size: 10px; color: #64748b;">
        Generated via College Academic Timetable System • ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
      </td>
    </tr>
  `;

  const excelTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
      <style>
        table { border-collapse: collapse; font-family: Calibri, 'Segoe UI', Arial, sans-serif; }
        th, td { border: 1px solid #cbd5e1; }
      </style>
    </head>
    <body>
      <table border="1">${tableRows}</table>
    </body>
    </html>
  `;

  const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeFilename = `${entityTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_Timetable.xls`;
  a.href = url;
  a.download = safeFilename;
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Generates a clean tabular CSV matrix representing the weekly timetable.
 */
export function exportTimetableToCSV({
  slots,
  entityTitle,
  termName = 'Academic Term',
}: TimetableExportOptions) {
  let csv = `"${entityTitle.toUpperCase()} - ${termName.toUpperCase()}"\n`;
  csv += `"Time Slot","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"\n`;

  const coveredSlotMap: Record<string, { until: number; code: string }> = {
    MON: { until: -1, code: '' },
    TUE: { until: -1, code: '' },
    WED: { until: -1, code: '' },
    THU: { until: -1, code: '' },
    FRI: { until: -1, code: '' },
    SAT: { until: -1, code: '' },
  };

  TIME_WINDOWS.forEach((win, wIdx) => {
    let row = `"${win.label}"`;

    if (win.isLunch) {
      row += `,"LUNCH BREAK","LUNCH BREAK","LUNCH BREAK","LUNCH BREAK","LUNCH BREAK","LUNCH BREAK"`;
    } else {
      DAYS.forEach((day) => {
        // If covered by a multi-hour block from an earlier window
        if (coveredSlotMap[day.code].until >= wIdx) {
          row += `,"${coveredSlotMap[day.code].code} (Cont.)"`;
          return;
        }

        const occupyingSlots = slots.filter(
          (s) => s.day_of_week === day.code && doesOverlap(s.start_time, s.end_time, win.start, win.end)
        );

        if (occupyingSlots.length > 0) {
          const slot = occupyingSlots[0];

          // Calculate span across consecutive non-lunch windows
          let span = 1;
          for (let nextWIdx = wIdx + 1; nextWIdx < TIME_WINDOWS.length; nextWIdx++) {
            const nextWin = TIME_WINDOWS[nextWIdx];
            if (nextWin.isLunch) break;
            if (doesOverlap(slot.start_time, slot.end_time, nextWin.start, nextWin.end)) {
              span++;
            } else {
              break;
            }
          }

          const courseCode = slot.is_custom
            ? slot.custom_title || 'Custom'
            : slot.section_subject?.course?.code || 'Course';

          if (span > 1) {
            coveredSlotMap[day.code] = { until: wIdx + span - 1, code: courseCode };
          }

          const section = slot.section_subject?.section?.name ? `Sec ${slot.section_subject.section.name}` : '';
          const isAsync = !slot.is_custom && (!slot.room || slot.is_async);
          const isLab = !slot.is_custom && !isAsync && (slot.room?.room_type === 'LABORATORY' || slot.section_subject?.course?.has_lab);
          const type = slot.is_custom ? 'Custom' : isAsync ? 'Async' : isLab ? `Lab ${span}h` : 'Lec';
          const room = slot.is_custom
            ? (slot.room ? `Rm ${slot.room.room_number}` : 'Custom')
            : isAsync
            ? 'Online / Async'
            : (slot.room ? `Rm ${slot.room.room_number}` : 'TBA');
          const prof = slot.section_subject?.professor
            ? `${slot.section_subject.professor.first_name?.[0] || ''}. ${slot.section_subject.professor.last_name}`
            : '';

          const timeRange = `${slot.start_time?.substring(0, 5)}-${slot.end_time?.substring(0, 5)}`;
          const cellText = `${courseCode} [${type} ${timeRange}] (${section ? `${section}, ` : ''}${room}${prof ? `, ${prof}` : ''})`;
          row += `,"${cellText}"`;
        } else {
          row += `,""`;
        }
      });
    }

    csv += `${row}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeFilename = `${entityTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_Timetable.csv`;
  a.href = url;
  a.download = safeFilename;
  a.click();
  window.URL.revokeObjectURL(url);
}

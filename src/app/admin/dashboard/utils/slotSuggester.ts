export interface SlotSuggestion {
  day: string;
  startTime: string; // "HH:MM:SS"
  endTime: string;   // "HH:MM:SS"
  startTimeFormatted: string; // "9:30 AM"
  endTimeFormatted: string;   // "11:30 AM"
  room: any;
  reason?: string;
  score: number;
}

export function timeToMinutes(t: string | undefined | null): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00`;
}

export function formatTimeDisplay(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${(m || 0).toString().padStart(2, '0')} ${period}`;
}

export function doesTimeOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return Math.max(start1, start2) < Math.min(end1, end2);
}

export interface SuggestSlotsParams {
  subject: any; // SectionSubject with blockInfo
  scheduleSlots: any[];
  rooms: any[];
  instructors: any[];
}

/**
 * Intelligently suggests non-colliding insertion slots for an unscheduled subject block,
 * strictly evaluating:
 * 1. Assigned faculty's declared availability days & hours (respecting Sunday off-duty)
 * 2. Assigned faculty's busy slots (preventing double-booking)
 * 3. Section cohort's busy slots (preventing concurrent section classes)
 * 4. Compatible room availability (Laboratory vs Lecture, capacity threshold)
 * 5. Universal lunch break buffer (12:00 - 13:00)
 */
export function suggestFacultySlots({
  subject,
  scheduleSlots,
  rooms,
  instructors,
}: SuggestSlotsParams): SlotSuggestion[] {
  if (!subject) return [];

  const professor = subject.professor;
  const section = subject.section;
  const blockType = subject.blockInfo?.type;
  const isAsync = blockType === 'Async';
  const isLab = blockType === 'Laboratory' || (!blockType && subject.course?.has_lab);
  const durationHours = subject.blockInfo?.hours || (isLab ? 3 : isAsync ? 1 : 2);
  const durationMinutes = Math.round(durationHours * 60);

  // 1. Determine eligible days based on faculty availability
  const allDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  let eligibleDays: string[] = allDays;

  if (professor && professor.available_days) {
    const declaredDays = professor.available_days.split(',').map((d: string) => d.trim().toUpperCase());
    eligibleDays = allDays.filter((d) => declaredDays.includes(d));
    // If professor explicitly has SUN declared and enabled
    if (declaredDays.includes('SUN')) {
      eligibleDays.push('SUN');
    }
  }

  // 2. Determine faculty operating hours window
  const profStartMin = professor?.available_start_time
    ? timeToMinutes(professor.available_start_time)
    : 7 * 60 + 30; // 07:30 AM
  const profEndMin = professor?.available_end_time
    ? timeToMinutes(professor.available_end_time)
    : 19 * 60; // 07:00 PM

  // Universal lunch break window: 12:00 PM (720) to 1:00 PM (780)
  const LUNCH_START = 12 * 60;
  const LUNCH_END = 13 * 60;

  // 3. Filter eligible rooms matching subject requirements
  const eligibleRooms = rooms
    .filter((r) => {
      // Check room type
      if (isLab && r.room_type !== 'LABORATORY') return false;
      if (!isLab && r.room_type === 'LABORATORY') return false;
      // Check section capacity threshold if section has capacity set
      if (section?.capacity && r.capacity && r.capacity < section.capacity) return false;
      return true;
    })
    // Fallback if no specialized room matches capacity
    .concat(rooms.filter((r) => !isLab && r.room_type === 'LECTURE'));

  const candidateRooms = Array.from(new Set(eligibleRooms.length > 0 ? eligibleRooms : rooms));

  // 4. Standard candidate starting times (in minutes)
  const candidateStartMinutes = [
    7 * 60 + 30,  // 07:30
    8 * 60 + 30,  // 08:30
    9 * 60,       // 09:00
    9 * 60 + 30,  // 09:30
    10 * 60,      // 10:00
    10 * 60 + 30, // 10:30
    13 * 60,      // 13:00 (1:00 PM)
    13 * 60 + 30, // 13:30 (1:30 PM)
    14 * 60,      // 14:00 (2:00 PM)
    14 * 60 + 30, // 14:30 (2:30 PM)
    15 * 60,      // 15:00 (3:00 PM)
    15 * 60 + 30, // 15:30 (3:30 PM)
    16 * 60,      // 16:00 (4:00 PM)
  ];

  const suggestions: SlotSuggestion[] = [];

  for (const day of eligibleDays) {
    // Collect existing slots on this day for rapid lookup
    const daySlots = scheduleSlots.filter((s) => s.day_of_week === day);

    // Slots already assigned to this faculty on this day
    const profSlots = professor
      ? daySlots.filter((s) => s.section_subject?.professor?.id === professor.id || s.professor?.id === professor.id)
      : [];

    // Slots already assigned to this section on this day
    const sectionSlots = section
      ? daySlots.filter((s) => s.section_subject?.section?.id === section.id)
      : [];

    for (const startMin of candidateStartMinutes) {
      const endMin = startMin + durationMinutes;

      // Must fit in professor's declared working hours
      if (startMin < profStartMin || endMin > profEndMin) continue;

      // Must not intersect with lunch break
      if (doesTimeOverlap(startMin, endMin, LUNCH_START, LUNCH_END)) continue;

      // Must not collide with professor's existing classes
      const hasProfCollision = profSlots.some((s) => {
        const sStart = timeToMinutes(s.start_time);
        const sEnd = timeToMinutes(s.end_time);
        return doesTimeOverlap(startMin, endMin, sStart, sEnd);
      });
      if (hasProfCollision) continue;

      // Must not collide with section's existing classes
      const hasSectionCollision = sectionSlots.some((s) => {
        const sStart = timeToMinutes(s.start_time);
        const sEnd = timeToMinutes(s.end_time);
        return doesTimeOverlap(startMin, endMin, sStart, sEnd);
      });
      if (hasSectionCollision) continue;

      // Find an available room that is free during this entire time (unless Asynchronous)
      let matchingRoom: any = null;
      if (!isAsync) {
        for (const room of candidateRooms) {
          const hasRoomCollision = daySlots.some((s) => {
            if (s.room?.id !== room.id) return false;
            const sStart = timeToMinutes(s.start_time);
            const sEnd = timeToMinutes(s.end_time);
            return doesTimeOverlap(startMin, endMin, sStart, sEnd);
          });

          if (!hasRoomCollision) {
            matchingRoom = room;
            break;
          }
        }

        if (!matchingRoom) continue;
      }

      // Compactness score: prefer slots on days where professor or section already has classes (minimizing fragmented off-days)
      let score = 10;
      if (isAsync) {
        score += 15; // Asynchronous classes are highly flexible
        if (day === 'FRI' || day === 'SAT') score += 10; // Friday/Saturday are prime institutional async days
      } else {
        if (profSlots.length > 0) score += 20; // faculty is already on campus this day
        if (sectionSlots.length > 0) score += 15; // section is already on campus this day
        if (startMin >= 8 * 60 + 30 && endMin <= 16 * 60) score += 5; // prime core daylight hours
      }

      const startTime = minutesToTime(startMin);
      const endTime = minutesToTime(endMin);

      suggestions.push({
        day,
        startTime,
        endTime,
        startTimeFormatted: formatTimeDisplay(startTime),
        endTimeFormatted: formatTimeDisplay(endTime),
        room: matchingRoom,
        score,
        reason: professor
          ? `${professor.last_name} & Sec ${section?.name || 'A'} are free`
          : `Sec ${section?.name || 'A'} & Room free`,
      });

      // Avoid suggesting too many identical overlapping start times on the same day
      if (suggestions.filter((s) => s.day === day).length >= 2) {
        break;
      }
    }

    if (suggestions.length >= 6) {
      break;
    }
  }

  // Sort by highest score first, return top 3-4 suggestions
  return suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
}

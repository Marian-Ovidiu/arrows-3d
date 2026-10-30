export interface TutorialProgress {
  rotated: boolean;
  blockedSeen: boolean;
}

export interface TutorialStep {
  id: 'rotate' | 'select' | 'extract' | 'blocked' | 'unblock' | 'finish' | 'done';
  number: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  targetId: string | null;
}

const TUTORIAL_IDS = ['intro-first', 'intro-blocked', 'intro-blocker', 'intro-last'];

/** Derive the current instruction from the board, including after undo/reload. */
export function getTutorialStep(
  remainingIds: readonly string[],
  selectedId: string | null,
  progress: TutorialProgress,
): TutorialStep {
  const remaining = new Set(remainingIds);
  if (remaining.size === 0) {
    return { id: 'done', number: 4, title: 'Ben fatto!', description: 'Hai liberato tutti i pezzi.', targetId: null };
  }
  if (TUTORIAL_IDS.every((id) => remaining.has(id)) && !progress.rotated) {
    return { id: 'rotate', number: 1, title: 'Cambia prospettiva', description: 'Trascina la figura con un dito o il mouse. Da tastiera, usa le frecce.', targetId: null };
  }
  if (remaining.has('intro-first')) {
    if (selectedId === 'intro-first') {
      return { id: 'extract', number: 2, title: 'La luce esce: la strada è libera', description: 'Tocca di nuovo lo stesso cubo per farlo uscire.', targetId: 'intro-first' };
    }
    return { id: 'select', number: 2, title: 'Accendi un percorso', description: 'Tocca il cubo con il bordo evidenziato. Un solo tocco accende la luce.', targetId: 'intro-first' };
  }
  if (remaining.has('intro-blocker')) {
    if (!progress.blockedSeen) {
      return { id: 'blocked', number: 3, title: 'E se la strada è occupata?', description: 'Tocca il cubo evidenziato e segui il suo fascio di luce.', targetId: 'intro-blocked' };
    }
    return { id: 'unblock', number: 3, title: 'La luce si ferma su un ostacolo', description: 'Libera il cubo che chiude la strada: è quello con il bordo evidenziato.', targetId: 'intro-blocker' };
  }
  const targetId = remaining.has('intro-blocked') ? 'intro-blocked' : 'intro-last';
  return { id: 'finish', number: 4, title: 'Ora il passaggio è aperto', description: 'Libera il cubo evidenziato, poi l’ultimo. La luce ti mostra quando puoi uscire.', targetId };
}

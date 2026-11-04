import type { ScoreMeta } from '../store'

export const sampleScores: ScoreMeta[] = [
  {
    id: 'canon-d',
    title: 'Canon in D (extracto)',
    tags: ['matrimonio', 'clásico', 'romántica'],
    repertoire: 'wedding',
    originalKey: 'D',
    hasAudio: false,
    abc: `X:1
T:Canon in D
M:4/4
L:1/4
K:D
V:1
D2 | F2 A2 | d2 A2 | F2 D2 | G2 B2 | d2 B2 | G2 |
V:2
z2 | D2 F2 | A2 F2 | D2 A,2 | E2 G2 | B2 G2 | E2 |`,
  },
  {
    id: 'happy-birthday',
    title: 'Happy Birthday',
    tags: ['fiesta', 'popular'],
    repertoire: 'party',
    originalKey: 'C',
    hasAudio: false,
    abc: `X:1
T:Happy Birthday
M:3/4
L:1/4
K:C
C/2C/2 | D C F | E2 C/2C/2 | D C G | F2 C/2C/2 |
A F E | D B,/2B,/2 | A F G | F2 ||`,
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    tags: ['romántica', 'tradicional'],
    repertoire: 'romantic',
    originalKey: 'Am',
    hasAudio: false,
    abc: `X:1
T:Greensleeves
M:6/8
L:1/8
K:Am
A | c2 d e> f e | d2 B G> A B | c2 A A> G A | B2 G E2 A |
c2 d e> f e | d2 B G> A B | c2 A B> A G | A3- A2 ||`,
  },
]

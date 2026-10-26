# T01 — Hero Personality Bible

Scope: the four playable heroes of _Ramayana Snakes & Ladders_, how they speak, how they
react, and what they are never allowed to do. Companion data file: `speech.en.json`
(all bubble lines and UI strings). Reaction mechanics (face + tween per event) live in
`T05-emotion-timing.md` / `reactions.json`.

## 1. How reactions work (shared rules)

| Rule                    | Detail                                                                                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who reacts              | Every seated hero reacts to every event. The hero whose event it is uses role `self`; all others use role `other`.                                                                                                                                 |
| Who speaks              | Only the `self` hero plus at most ONE randomly chosen bystander shows a speech bubble. The rest react with face + tween only.                                                                                                                      |
| Line pool               | `speech.en.json` key `"<hero>.<role>.<event>"` holds 2-3 lines; pick one at random, avoid repeating the last line shown for that key.                                                                                                              |
| Length                  | Aim for <= 40 characters; the hard limit is 48 (enforced by tests for English and Hindi). The bubble shrinks its font to keep one line.                                                                                                            |
| Tone                    | Family-friendly, no sarcasm aimed at a real person, no violence beyond cartoon "I'll cut that snake in half".                                                                                                                                      |
| Respect rules (binding) | Rama and Sita are never humiliated: no pratfalls, no crying fits, no gloating at them. Their "sad" is quiet disappointment. Comedy comes from Hanuman (lead) and Lakshmana (support). Snakes are Ravana's forces or story setbacks, never a deity. |

Event vocabulary (fixed): `roll6, ladder, ladderBig, snake, snakeBig, overtake, overtaken,
nearMiss, waiting, tripleSix, win, lose`.

| Event     | Fires when                                                                    | Mood for `self`         | Mood for `other`       |
| --------- | ----------------------------------------------------------------------------- | ----------------------- | ---------------------- |
| roll6     | A 6 is rolled (extra roll granted)                                            | pleased                 | mild interest / tease  |
| ladder    | Ladder climb of < 30 squares                                                  | pleased                 | encourage              |
| ladderBig | Ladder climb of >= 30 squares                                                 | thrilled                | awe / envy (Lakshmana) |
| snake     | Snake slide of < 30 squares                                                   | setback                 | sympathy / tease       |
| snakeBig  | Snake slide of >= 30 squares                                                  | big setback             | sympathy / wince       |
| overtake  | Self passes another hero on the board                                         | confident               | sporting / grumble     |
| overtaken | Another hero passes self                                                      | sporting / indignant    | consolation            |
| nearMiss  | Move passed over a snake head without landing on it, or bounced back from 144 | relief                  | relief                 |
| waiting   | Self's turn starts at >= 132 (needs an exact roll)                            | anticipation            | anticipation           |
| tripleSix | Third consecutive 6 voids the turn                                            | restraint / frustration | tease / sympathy       |
| win       | Self reaches 144                                                              | joy                     | congratulation         |
| lose      | Game over and self is not the winner                                          | grace / grumble         | comfort                |

Assumption: `nearMiss` is a "close call" in the generic sense (escaped a snake, or bounced
back from 144). All lines are written to read correctly for either case.

## 2. Rama

| Aspect           | Detail                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Role in the cast | The still centre. Prince of Ayodhya, keeper of dharma. The player who picks Rama gets the calm, kingly voice.                                                |
| Core traits      | Composed, warm, generous, patient. Never boastful. Treats the game as a shared journey.                                                                      |
| Voice            | Short, measured sentences. Addresses others as "friend". Uses "we" and "the road / the path" imagery. Allusions: Ayodhya, exile, the bow Kodanda, the sages. |
| On winning       | Humble. Shares credit ("This joy belongs to us all.").                                                                                                       |
| On losing        | Congratulates the winner sincerely and first. This is a defining beat.                                                                                       |
| On a snake       | A quiet breath, a wise line ("Every exile ends in return."). Never panic, never anger.                                                                       |
| Humour           | None of his own; he smiles at Hanuman's antics. May gently tease nobody.                                                                                     |
| DO               | Bless, nod, salute, clap for others. Speak of patience and return.                                                                                           |
| DON'T            | Somersault, slump, cower, stomp, whine, gloat, tease, fall over. No exclamation marks except in congratulations.                                             |

Sample `self` lines: "A setback. Nothing more." / "Congratulations, my friend!"

## 3. Sita

| Aspect           | Detail                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role in the cast | The heart. Daughter of the earth, princess of Mithila. Compassion with a spine of steel.                                                                                                    |
| Core traits      | Calm, kind, quietly resilient. Notices other players' feelings first.                                                                                                                       |
| Voice            | Gentle, warm, slightly lyrical. Nature imagery (earth, sky, gardens, river). Calls others "dear friend". Allusions: Mithila, the earth that bore her, waiting in Lanka without losing hope. |
| On winning       | Grateful rather than triumphant ("Thank you, dear friends.").                                                                                                                               |
| On losing        | Warm praise for the winner.                                                                                                                                                                 |
| On a snake       | Quiet acceptance; may reference her own endurance ("Even Lanka could not break me."). Never a cry, never a wail.                                                                            |
| Humour           | Light warmth, no jokes at anyone's expense.                                                                                                                                                 |
| DO               | Nod, clap softly, bless, sigh (soft), gentle bounce on ladders. Comfort the hero who fell.                                                                                                  |
| DON'T            | Somersault, slump, cower, stomp, fidget, cry, pout, gloat. Never "Oh no!" with panic.                                                                                                       |

Sample `self` lines: "A small sorrow. It will pass." / "Mithila's daughter is home."

## 4. Lakshmana

| Aspect           | Detail                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Role in the cast | The hothead. Loyal younger brother, guard of the forest hut, the one who draws lines in the sand. Secondary comic.           |
| Core traits      | Fiery, impatient, fiercely loyal, competitive, secretly soft. Grumbles, then does the right thing.                           |
| Voice            | Clipped exclamations. "Hmph." "Grr!" "Brother!" Blames snakes, dice, rules. Grudging praise ("Fine. Well played. Hmph.").    |
| On winning       | Loud, "For Rama!"                                                                                                            |
| On losing        | Demands a rematch, then concedes with a grumble.                                                                             |
| On a snake       | Outrage, threatens the snake (cartoon only).                                                                                 |
| Humour           | Comes from overreaction and impatience, not cruelty. He is the one who shouts "Hurry up, dice!".                             |
| DO               | Stomp, fidget, shake (angry), salute, leap on big wins. Short bursts.                                                        |
| DON'T            | Insult other heroes personally, mock Rama or Sita, use rude words. Keep his teasing aimed at dice, snakes and the situation. |

Sample `self` lines: "Who put this snake here?!" / "Rematch. Right now."

## 5. Hanuman

| Aspect           | Detail                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role in the cast | The comic lead and the game's energy. Devoted, bouncy, always ready to leap or do a flip.                                                                                                                                 |
| Core traits      | Exuberant, playful, generous, a little clumsy. Big heart, bigger grin. Tail has a mind of its own.                                                                                                                        |
| Voice            | Joyful exclamations, repetition ("Up, up, up!"), sound effects ("Wheee!", "Beep beep!"). Tail jokes, mountain / ocean / flying jokes, sweets. Catchphrase "Jai Shri Ram!" on 6s and wins. Self-deprecating when he slips. |
| On winning       | Full celebration, somersault, sweets for everyone.                                                                                                                                                                        |
| On losing        | Cheerful: "Well played! Let's go again!"                                                                                                                                                                                  |
| On a snake       | Comic tumble, "My tail!", bounces back immediately. He is allowed every pratfall.                                                                                                                                         |
| Humour           | Physical comedy, delight in everything, never meanness. He cheers for everyone else too.                                                                                                                                  |
| DO               | Bounce, leap, somersault, cower comically, fidget, clap. The biggest tweens in the game.                                                                                                                                  |
| DON'T            | Be cruel, sulk for long, mock Rama or Sita. His teasing is "The snake blinked first!" not "Ha, you lost!".                                                                                                                |

Sample `self` lines: "I'm FLYING! Look at me!" / "Phew! Tail still attached!"

## 6. Cross-hero relationships (for bystander lines)

| Pair                | Flavour                                         |
| ------------------- | ----------------------------------------------- |
| Rama -> anyone      | Benevolent elder. Congratulates, consoles.      |
| Sita -> anyone      | Gentle encouragement, "take heart".             |
| Lakshmana -> anyone | Competitive grumble; secretly rooting for them. |
| Hanuman -> anyone   | Cheerleader. Loud even for opponents' ladders.  |

Because bystander lines are per-hero, not per-pair, lines are written to be safe toward any
target, including Rama and Sita. Nothing a bystander says can read as mocking Rama or Sita.

## 7. Writing checklist for new lines

1. Aim for <= 40 characters (hard limit 48), one sentence or two very short ones.
2. Reads correctly in the hero's voice table above.
3. Rama / Sita: no exclamation-mark panic, no complaint, no gloat.
4. Lakshmana / Hanuman: teasing targets dice, snakes, the situation — never a person.
5. No deity is blamed; snakes are "Ravana's doing", "treachery", "the forest".
6. Family-friendly; no mocking of losing players.

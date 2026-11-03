# T01 — Hero Personality Bible

Scope: the six playable heroes of _Ramayana Snakes & Ladders_ (Bharata and Shatrughna added in T46), how they speak, how they
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
| Respect rules (binding) | Rama and Sita are never humiliated: no pratfalls, no crying fits, no gloating at them. Their "sad" is quiet disappointment; Bharata keeps the same restraint. Comedy comes from Hanuman (lead), Lakshmana and Shatrughna (support). Snakes are Ravana's forces or story setbacks, never a deity. |

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

## 6. Bharata

| Aspect           | Detail |
| ---------------- | ------ |
| Role in the cast | The devoted regent. Rama's brother who refused the throne and ruled Ayodhya in Rama's name for fourteen years, Rama's padukas on the throne. The quiet conscience of the cast. |
| Core traits      | Gentle, humble, steadfast, deeply loyal. Restrained like Rama, but softer: where Rama is serene, Bharata is reverent. |
| Voice            | Soft, humble sentences; speaks of serving, waiting and keeping faith. Calls Rama "brother" in his own and pair lines; his generic bystander lines say "friend", as Rama's do. Allusions: the padukas, Nandigram, the fourteen-year vigil. |
| On winning       | Gives the win away: "I have kept the throne for Rama." / "This joy is my brother's." |
| On losing        | Rejoices for the winner first, like Rama. |
| On a snake       | Patient endurance ("Fourteen years I waited. I can wait."). Never anger, never panic. |
| Humour           | None of his own; a warm smile at the others. |
| DO               | Nod, bless, salute (hand to heart), sigh, clap for others. Hold the padukas with both hands, always. |
| DON'T            | Somersault, slump, cower, stomp, fidget, shake; no `scared` face. No exclamation marks except in congratulations and praise. The padukas are never joked about, dropped or swung. |

Sample `self` lines: "The throne is Rama's, not mine." / "The padukas are home at last."

## 7. Shatrughna

| Aspect           | Detail |
| ---------------- | ------ |
| Role in the cast | The youngest brother, Bharata's faithful companion. Eager and warm; the little brother who wants to keep up with everyone. |
| Core traits      | Loyal, enthusiastic, warm-hearted, a little impulsive. Like Lakshmana he flares up, but his heat turns to cheering rather than grumbling. |
| Voice            | Quick exclamations, repetition ("Come on, come on!", "Go, go, go!"), "Whoa!", "Hooray!". Calls the elder brothers "brother". Proud to be the youngest. |
| On winning       | Delighted: "The youngest wins! Ha!" / "Brothers, I made it!" |
| On losing        | Sporting at once, then asks to play again. |
| On a snake       | Indignant at the snake ("That snake is Ravana's spy!"), climbs straight back. |
| Humour           | Eagerness and impatience, never cruelty. His teasing, like Lakshmana's, targets dice and snakes only. |
| DO               | Bounce, leap, clap, fidget, stomp, salute. Comic face set allowed. |
| DON'T            | Mock anyone, sulk, or say anything about Rama, Sita or the padukas that is not respectful. |

Sample `self` lines: "Climbing! Bharata, look!" / "The youngest wins! Ha!"

## 8. Cross-hero relationships (for bystander lines)

| Pair                | Flavour                                         |
| ------------------- | ----------------------------------------------- |
| Rama -> anyone      | Benevolent elder. Congratulates, consoles.      |
| Sita -> anyone      | Gentle encouragement, "take heart".             |
| Lakshmana -> anyone | Competitive grumble; secretly rooting for them. |
| Hanuman -> anyone   | Cheerleader. Loud even for opponents' ladders.  |
| Bharata -> anyone   | Humble blessing, "take heart, friend".          |
| Shatrughna -> anyone | Eager cheering, "Go, go, go!" for everyone.    |

Because bystander lines are per-hero, not per-pair, lines are written to be safe toward any
target, including Rama and Sita. Nothing a bystander says can read as mocking Rama or Sita. The
generic `other` pools of Bharata and Shatrughna name nobody and use no kinship word, since the
mover can be any hero.

**Between the brothers (T46).** A bystander reacting to a brother on `ladderBig`, `snakeBig` or
`win` also draws from `<speaker>.to.<mover>.<event>` (2 lines each, mixed into the speaker's
`other` pool: `speech(..., target)` in `src/i18n/i18n.ts`, the mover from `targetOf` in
`src/characters/reactionMapper.ts`). Pairs: Bharata and Shatrughna toward each other brother,
Rama and Lakshmana toward Bharata and Shatrughna.

| Pair                    | Flavour |
| ----------------------- | ------- |
| Bharata -> Rama         | Reverent younger brother: "Brother, your padukas wait for you." |
| Bharata -> Lakshmana    | Calm elder; praises his loyalty, steadies his temper: "Steady, Lakshmana. No anger." |
| Bharata -> Shatrughna   | Tender elder: "Take my hand, Shatrughna." |
| Shatrughna -> Rama      | Adoring youngest: "Brother Rama is king again!" |
| Shatrughna -> Lakshmana | Playful rival: "Race you to the top, brother!" |
| Shatrughna -> Bharata   | Loyal companion who guards the padukas: "The padukas are safe, brother!" |
| Rama -> Bharata         | Loving elder: "No one deserves it more, brother!" |
| Rama -> Shatrughna      | Gentle elder: "Well done, youngest brother." |
| Lakshmana -> Bharata    | Grudging respect turned warm: "Hmph. Well climbed, Bharata." |
| Lakshmana -> Shatrughna | Big-brother teasing: "Ha! That's my little brother!" |

**Hindi (T46): needs a native-speaker check.** The Bharata and Shatrughna lines and all pair
lines in `hi.json` were written without a native speaker. They use आप toward others
(Shatrughna is the youngest, so his lines may land on elders), भैया for elder brothers and
पादुकाएँ for the padukas. Add them to the next native-speaker pass (T44 R11).

## 9. Writing checklist for new lines

1. Aim for <= 40 characters (hard limit 48), one sentence or two very short ones.
2. Reads correctly in the hero's voice table above.
3. Rama / Sita / Bharata: no exclamation-mark panic, no complaint, no gloat.
4. Lakshmana / Shatrughna / Hanuman: teasing targets dice, snakes, the situation — never a person.
5. No deity is blamed; snakes are "Ravana's doing", "treachery", "the forest".
6. Family-friendly; no mocking of losing players.
7. The padukas are spoken of only with reverence; nobody teases about them.
8. Generic `other` lines name nobody and use no kinship word; brother lines go in `self` or the pair pools.

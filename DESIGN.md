# Mochi Pop: design notes

**Pitch:** drag cute mochi blocks onto an 8×8 board, clear rows and columns, chain combos into Fever, and spend coins on capsules to collect new mochi friends.

## What it borrows, and from whom

| Mechanic | Borrowed from | Why it works |
|---|---|---|
| 8×8 drag-and-drop block placement, 3 pieces per tray, rows and columns clear | Block Blast, 1010!, Woodoku | One-thumb, no timer, instantly readable; one of the most downloaded casual formats of 2024–25 |
| Combo streak (keep clearing within 3 moves) with escalating chimes | Block Blast | Rewards planning ahead and makes multi-clears feel huge |
| "Sweet Line": a line that is all one colour pays a bonus | Candy Crush colour matching | Adds a second goal layered on the first |
| Fever meter fills with clears, then 8 moves of ×2 points and coins with a rainbow board | Subway Surfers / Candy Crush boosters | A periodic power spike breaks monotony |
| Star mochis (+5 coins when popped) | Royal Match collectibles | Small surprise rewards inside normal play |
| Capsule machine with Common/Rare/Epic skins | Gacha, Neko Atsume, Pokémon-style collection | A long-term reason to keep earning coins |
| 7-day login calendar, 3 daily missions | Nearly every top-grossing casual game | Gives players a reason to come back each day |
| Boosters (hammer, bomb, new pieces), one paid "continue" | Candy Crush / Block Blast rescue items | A near miss feels saveable, so the player tries again |
| Player level and XP, with booster rewards on level-up | Royal Match | Steady progress even after bad runs |

## Core loop

1. Place a piece. You get a soft "plop", a haptic tick, and the mochi squishes in.
2. A row or column fills: it pops in a wave out from the piece, with confetti, a rising arpeggio, screen shake and praise text (Nice / Sweet / Yummy / Delicious).
3. Combo and Fever build up, and your score multiplies.
4. When the board jams, you can use a booster, buy a continue, or start over.
5. Coins go to capsules, which unlock new skins (Kitty, Teddy, Bunbun, Chirp, Froggy, Panpan, Blip). The skin you equip changes every block on the board.

## Fairness and "one more go" tuning
- Each new tray is guaranteed to have at least one piece that fits.
- About 38% of trays include a piece that can clear a line somewhere on the board, which hands the player frequent small wins.
- Difficulty rises with score: big pieces get more common and single cells get rarer.
- Scoring: 1/2/3/4 lines pay 100/300/600/1000, multiplied by the combo bonus (1 + 0.5 for each step after the first) and by 2 during Fever. A Sweet Line adds 250, and clearing the whole board adds 2000.

## Feel
- Pastel candy palette and a rounded font (Fredoka). Every block is a mochi with a face: it blinks, and it smiles when the line it sits in is about to clear.
- All sound is generated in code (Web Audio), with a soft background loop. Sound, music and vibration each have their own toggle.
- The board is saved after every move, so closing the app never loses a run.

## Ideas for later
- Ad-rewarded continue and double coins; a no-ads in-app purchase
- Weekly event board (collect N star mochis for an exclusive skin)
- Leaderboards (Google Play Games), cloud save
- An adventure mode with hand-made levels and goals ("pop 20 pink mochis")

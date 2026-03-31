# 🏈 Football Dice — Online Multiplayer

A browser-based, two-player American football simulation game driven entirely by dice rolls. No downloads, no installation for players — just share a room code and play.

---

## What is Football Dice?

Football Dice is a tabletop-inspired digital game that simulates a full American football match using dice and a result table. On each turn, the active player rolls dice and cross-references the result on a chart to determine the outcome of the play — yardage gained or lost, turnovers, touchdowns, penalties, and more. The game tracks field position, downs, possessions, and score in real time, and both players see everything simultaneously thanks to a live WebSocket connection.

It is designed for two players who want a quick, fun football experience with genuine strategic tension — when to punt, when to attempt a field goal, whether to burn a timeout on a turnover situation — without the complexity of a full video game.

---

## How the Game Works

### Field and Possession

The field is represented as a 100-yard canvas with yard markers, hash marks, and a ball indicator that moves after every play. Each player attacks in one direction. Field position is shown as a yard line labeled by the side of the field it is on (e.g., *P1 35* means the 35-yard line on Player 1's side).

### Possessions and Game Length

Before the game starts, Player 1 chooses between a **5-possession** or **10-possession** game. Each time the ball changes hands it counts as one possession for the receiving team. When both players have used their last possession, the game ends and the higher score wins.

### The Dice Roll — Main Play Table

On offense, the active player chooses one of two play buttons:

| Button | Dice rolled | How it works |
|--------|-------------|--------------|
| **2 DICE PLAY** | 2 dice | D1 selects the row, D2 selects the column |
| **3 DICE PLAY** | 3 dice | D1 selects the row, D2+D3 (sum) select the column |

The intersection of row and column on the **7×12 main table** gives the play result. Possible outcomes include:

- **Positive numbers** — yards gained (e.g., 8, 18, 37)
- **0** — incomplete pass, no gain
- **Negative numbers** — yards lost due to a sack (-3, -8) or penalty (-5, -10, -15)
- **TD** — Touchdown (6 points)
- **TO** — Turnover situation (see below)
- **DH** — Defensive Holding: automatic 5-yard gain and first down
- **FM** — Defensive Face Mask: automatic 15-yard gain and first down

### Downs and First Downs

The game uses standard 4-down American football rules. The offense starts each possession with **1st & 10**. If a play gains enough yards to cover the *to go* distance, the down resets to 1st & 10. If the offense fails to convert on 4th down, possession changes — a **Turnover on Downs**.

### Turnovers (TO)

When the result is **TO**, a modal dialog appears asking the active player to make a decision:

- **TIMEOUT** — spend one of 3 available timeouts to avoid the turnover; the down continues
- **TURNOVER** — accept the turnover; the opponent takes possession at the current yard line

If no timeouts remain, the turnover is automatic.

### Special Plays

#### Punt
The **PUNT** button uses a separate row on the table (D2 + D3 determine distance). The opponent takes over at the resulting field position. Touchbacks spot the ball at the opponent's 25-yard line.

#### Field Goal (FG) / PAT
The **FG** button is available when the offense is in opponent territory. After a touchdown it becomes **PAT** (extra point attempt). A single die is rolled and the result is checked against the **PAT/FG secondary table**:

- **0–34 yd field goals**: most die results are good
- **35–50 yd field goals**: harder, fewer good results
- **PAT**: almost always good — only a 3 misses

A missed field goal or PAT gives the ball to the opponent at the kicking spot. A successful kick sends the ball to the opponent's 30-yard line.

#### 2-Point Conversion
The **2 PT** button appears after a touchdown as an alternative to the PAT. The secondary table determines success; only a 3 or 4 converts.

#### Safety
If a play with a negative result pushes the ball behind the offense's own goal line (yard position goes below 0), it is a **Safety** — 2 points are awarded to the defending team, who then take possession.

### Scoring Summary

| Event | Points |
|-------|--------|
| Touchdown | 6 |
| PAT (extra point) | 1 |
| 2-Point Conversion | 2 |
| Field Goal | 3 |
| Safety | 2 (awarded to the defense) |

### End of Game

When the last possession ends, the game is over. A **Game Over** screen displays the final score alongside a full statistical breakdown for both players:

- Touchdowns
- Field Goals (made/attempted)
- Extra Points (made/attempted)
- 2-Point Conversions (made/attempted)
- Punts
- Turnovers
- Safeties

---

## Online Multiplayer — How to Set It Up

Football Dice runs on a **Node.js + Socket.io** server. Both players open the game in a browser; all game state is synchronized in real time.

### Requirements

- Node.js (v16 or later)
- npm

### Installation

```bash
# 1. Install dependencies
npm install express socket.io

# 2. Place the game files in the /public folder
#    public/
#      index.html
#      styles60.css
#      png files

# 3. Start the server
node server.js
```

### Joining a Game

1. Both players open the game URL in their browsers.
2. Each player types the **same room code** (any text, e.g. `mygame`) and clicks **Join Room**.
3. Once both players are connected, Player 1 chooses the game length (5 or 10 possessions) and the match begins.
4. The turn banner at the top of the screen shows whose turn it is at all times. The UI is locked for the player who is not currently on offense.

Room codes are case-sensitive. Up to two players per room; additional connections will be rejected with a "room full" message.

---

## Project File Structure

```
/
├── server.js          # Node.js + Socket.io server
└── public/
    ├── index.html     # Game client (all HTML, CSS, and JS in one file)
    ├── styles60.css   # External stylesheet
    └── png images     # Images used on field and table
```

---

## Technical Overview

| Layer | Technology |
|-------|-----------|
| Server | Node.js, Express, Socket.io |
| Client | Vanilla HTML/CSS/JavaScript |
| Real-time sync | WebSockets via Socket.io |
| Game state | Managed on the active client, synced to the server and mirrored to the opponent after each play |

### Key Synchronization Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `joinRoom` | Client → Server | Join or create a game room |
| `startGame` | Client → Server | Player 1 sets game length |
| `diceRoll` | Client → Server → Both | Broadcast dice values and table highlight coordinates |
| `syncState` | Client → Server → Opponent | Full game state after each play |
| `playByPlay` | Client → Server → Opponent | Sync the play-by-play log |
| `toDecision` | Client → Server → Opponent | Broadcast timeout/turnover decision |
| `gameOver` | Client → Server → Opponent | Trigger the final stats screen |

---

## Gameplay Tips

- **3 DICE PLAY** gives a wider spread of column outcomes (D2+D3 ranges from 2 to 12), making big gains more likely but also increasing variance.
- **2 DICE PLAY** keeps the column between 1 and 6 — safer but lower upside.
- Save timeouts for late-game turnover situations when field position matters most.
- A punt from deep in your own end can reliably flip field position; the punt table rewards longer distances at higher column values.
- Field goals from beyond 35 yards are risky — the secondary table has fewer "Good" results in that range.

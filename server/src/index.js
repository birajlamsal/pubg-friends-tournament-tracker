const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { nanoid } = require("nanoid");
const { getCollection, setCollection, updateById } = require("./storage");
const { verifyAdmin, createToken, authMiddleware } = require("./auth");
const {
  aggregateTournament,
  aggregateCustomMatches,
  aggregateMatchIds,
  fetchPlayerMatches,
  fetchMatchSummaries
} = require("./pubg");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const makeId = (prefix) => {
  const randPart = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${randPart}`;
};

const ensureBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
};

const normalizePlayerNames = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((name) => String(name).trim()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
};

const normalizeMatchIds = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((id) => String(id).trim()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
};

const sortByField = (items, field, direction = "desc") => {
  const sorted = [...items];
  sorted.sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    if (aVal === bVal) {
      return 0;
    }
    if (aVal === null || aVal === undefined) {
      return 1;
    }
    if (bVal === null || bVal === undefined) {
      return -1;
    }
    if (typeof aVal === "string" || typeof bVal === "string") {
      const compare = String(aVal).localeCompare(String(bVal));
      return direction === "asc" ? compare : -compare;
    }
    return direction === "asc" ? aVal - bVal : bVal - aVal;
  });
  return sorted;
};

const isInvalidDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return false;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return false;
  }
  return end < start;
};

const sanitizeTournament = (tournament) => {
  const { tournament_api_key, ...rest } = tournament;
  return rest;
};

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/pubg/player-matches", async (req, res) => {
  const apiKey = process.env.PUBG_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "PUBG API key not configured" });
  }
  const name = String(req.query.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Player name is required" });
  }
  try {
    const limit = Math.min(Number(req.query.limit || 50), 60);
    const includeMeta = String(req.query.includeMeta || "").toLowerCase() === "true";
    const matchIds = await fetchPlayerMatches({ apiKey, playerName: name, limit });
    if (!includeMeta) {
      return res.json({ player: name, matches: matchIds });
    }
    const metaLimit = Math.min(matchIds.length, 50);
    const onlyCustom = String(req.query.onlyCustom || "").toLowerCase() === "true";
    const summaries = await fetchMatchSummaries({
      apiKey,
      matchIds: matchIds.slice(0, metaLimit)
    });
    const filtered = onlyCustom
      ? summaries.filter((match) => match.is_custom_match === true)
      : summaries;
    return res.json({
      player: name,
      matches: filtered,
      meta: { limited_to: metaLimit, only_custom: onlyCustom }
    });
  } catch (error) {
    res.status(502).json({ error: "PUBG API error", details: error.message });
  }
});

app.get("/api/featured-tournaments", (req, res) => {
  const tournaments = getCollection("tournaments");
  const featured = tournaments
    .filter((item) => item.featured === true)
    .map(sanitizeTournament);
  res.json(featured);
});

app.get("/api/tournaments", (req, res) => {
  const tournaments = getCollection("tournaments");
  const { status, registration, mode, search, sort } = req.query;

  let filtered = [...tournaments];

  if (status) {
    filtered = filtered.filter((item) => item.status === status);
  }
  if (registration) {
    filtered = filtered.filter((item) => item.registration_status === registration);
  }
  if (mode) {
    filtered = filtered.filter((item) => item.mode === mode);
  }
  if (search) {
    const term = String(search).toLowerCase();
    filtered = filtered.filter((item) => item.name.toLowerCase().includes(term));
  }

  if (sort) {
    if (sort === "start_date") {
      filtered = sortByField(filtered, "start_date", "asc");
    }
    if (sort === "prize_pool") {
      filtered = sortByField(filtered, "prize_pool", "desc");
    }
    if (sort === "registration_charge") {
      filtered = sortByField(filtered, "registration_charge", "desc");
    }
  }

  res.json(filtered.map(sanitizeTournament));
});

app.get("/api/tournaments/:id", (req, res) => {
  const tournaments = getCollection("tournaments");
  const tournament = tournaments.find((item) => item.tournament_id === req.params.id);
  if (!tournament) {
    return res.status(404).json({ error: "Tournament not found" });
  }
  const participants = getCollection("participants").filter(
    (item) => item.tournament_id === req.params.id
  );
  res.json({
    ...sanitizeTournament(tournament),
    participants
  });
});

app.get("/api/tournaments/:id/live", async (req, res) => {
  const tournaments = getCollection("tournaments");
  const tournament = tournaments.find((item) => item.tournament_id === req.params.id);
  if (!tournament) {
    return res.status(404).json({ error: "Tournament not found" });
  }
  const apiKey = tournament.tournament_api_key || process.env.PUBG_API_KEY;
  if (!tournament.api_key_required || !apiKey) {
    return res.status(400).json({ error: "PUBG API key not configured" });
  }
  try {
    const limit = Number(req.query.limit || 12);
    const fresh = String(req.query.fresh || "").toLowerCase() === "true";
    let data;
    if (tournament.custom_match_mode) {
      const matchIds = normalizeMatchIds(tournament.custom_match_ids);
      const allowNonCustom = tournament.allow_non_custom === true;
      if (matchIds.length) {
        data = await aggregateMatchIds({
          apiKey,
          matchIds,
          limit,
          fresh,
          onlyCustom: !allowNonCustom
        });
      } else {
        const playerNames = normalizePlayerNames(tournament.custom_player_names);
        if (!playerNames.length) {
          return res.status(400).json({
            error: "Custom match needs match IDs or player names"
          });
        }
        data = await aggregateCustomMatches({
          apiKey,
          playerNames,
          limit,
          fresh,
          includeNonCustom: allowNonCustom
        });
      }
    } else {
      if (!tournament.pubg_tournament_id) {
        return res.status(400).json({ error: "PUBG tournament ID not configured" });
      }
      data = await aggregateTournament({
        apiKey,
        tournamentId: tournament.pubg_tournament_id,
        limit,
        fresh
      });
    }
    res.json({
      source: tournament.custom_match_mode ? "pubg-custom" : "pubg",
      tournament_id: tournament.tournament_id,
      pubg_tournament_id: tournament.pubg_tournament_id,
      ...data
    });
  } catch (error) {
    res.status(502).json({ error: "PUBG API error", details: error.message });
  }
});

app.get("/api/matches", (req, res) => {
  const matches = getCollection("matches");
  const limit = Number(req.query.limit || 6);
  res.json(matches.slice(0, limit));
});

app.get("/api/team-stats", (req, res) => {
  const stats = getCollection("teamStats");
  res.json(stats);
});

app.get("/api/player-stats", (req, res) => {
  const stats = getCollection("playerStats");
  res.json(stats);
});

app.get("/api/winners", (req, res) => {
  const winners = getCollection("winners");
  res.json(winners);
});

app.get("/api/announcements", (req, res) => {
  const announcements = getCollection("announcements");
  res.json(announcements);
});

app.get("/api/players", (req, res) => {
  const players = getCollection("players");
  res.json(players);
});

app.get("/api/teams", (req, res) => {
  const teams = getCollection("teams");
  res.json(teams);
});

app.get("/api/upcoming-matches", (req, res) => {
  const upcoming = getCollection("upcomingMatches");
  res.json(upcoming);
});

app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;
  const isValid = await verifyAdmin(username, password);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = createToken({ username });
  res.json({ token });
});

app.use("/api/admin", authMiddleware);

app.get("/api/admin/tournaments", (req, res) => {
  res.json(getCollection("tournaments"));
});

app.post("/api/admin/tournaments", (req, res) => {
  const tournaments = getCollection("tournaments");
  const payload = req.body || {};
  if (isInvalidDateRange(payload.start_date, payload.end_date)) {
    return res.status(400).json({ error: "End date cannot be before start date." });
  }
  const tournament = {
    tournament_id: payload.tournament_id || makeId("TE"),
    name: payload.name,
    description: payload.description || "",
    banner_url: payload.banner_url || "",
    start_date: payload.start_date,
    end_date: payload.end_date,
    status: payload.status || "upcoming",
    registration_status: payload.registration_status || "closed",
    mode: payload.mode || "squad",
    match_type: payload.match_type || "classic",
    perspective: payload.perspective || "TPP",
    prize_pool: Number(payload.prize_pool || 0),
    registration_charge: Number(payload.registration_charge || 0),
    featured: ensureBoolean(payload.featured) === true,
    max_slots: payload.max_slots || null,
    region: payload.region || "",
    rules: payload.rules || "",
    contact_discord: payload.contact_discord || "",
    api_key_required: ensureBoolean(payload.api_key_required) === true,
    tournament_api_key: payload.tournament_api_key || "",
    api_provider: payload.api_provider || "PUBG",
    pubg_tournament_id: payload.pubg_tournament_id || "",
    custom_match_mode: ensureBoolean(payload.custom_match_mode) === true,
    allow_non_custom: ensureBoolean(payload.allow_non_custom) === true,
    custom_player_names: normalizePlayerNames(payload.custom_player_names),
    custom_match_ids: normalizeMatchIds(payload.custom_match_ids)
  };
  tournaments.push(tournament);
  setCollection("tournaments", tournaments);
  res.status(201).json(tournament);
});

app.put("/api/admin/tournaments/:id", (req, res) => {
  const tournaments = getCollection("tournaments");
  const id = req.params.id;
  const existing = tournaments.find((item) => item.tournament_id === id);
  if (!existing) {
    return res.status(404).json({ error: "Tournament not found" });
  }
  const payload = req.body || {};
  const startDate =
    Object.prototype.hasOwnProperty.call(payload, "start_date")
      ? payload.start_date
      : existing.start_date;
  const endDate =
    Object.prototype.hasOwnProperty.call(payload, "end_date")
      ? payload.end_date
      : existing.end_date;
  if (isInvalidDateRange(startDate, endDate)) {
    return res.status(400).json({ error: "End date cannot be before start date." });
  }
  const updated = updateById(tournaments, "tournament_id", id, (current) => {
    const next = { ...payload };
    if (Object.prototype.hasOwnProperty.call(payload, "custom_match_mode")) {
      next.custom_match_mode = ensureBoolean(payload.custom_match_mode) === true;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "allow_non_custom")) {
      next.allow_non_custom = ensureBoolean(payload.allow_non_custom) === true;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "custom_player_names")) {
      next.custom_player_names = normalizePlayerNames(payload.custom_player_names);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "custom_match_ids")) {
      next.custom_match_ids = normalizeMatchIds(payload.custom_match_ids);
    }
    return {
      ...current,
      ...next,
      tournament_id: current.tournament_id
    };
  });
  if (!updated) {
    return res.status(404).json({ error: "Tournament not found" });
  }
  setCollection("tournaments", tournaments);
  res.json(updated);
});

app.delete("/api/admin/tournaments/:id", (req, res) => {
  const tournaments = getCollection("tournaments");
  const filtered = tournaments.filter((item) => item.tournament_id !== req.params.id);
  if (filtered.length === tournaments.length) {
    return res.status(404).json({ error: "Tournament not found" });
  }
  setCollection("tournaments", filtered);
  res.status(204).send();
});

app.get("/api/admin/players", (req, res) => {
  res.json(getCollection("players"));
});

app.post("/api/admin/players", (req, res) => {
  const players = getCollection("players");
  const payload = req.body || {};
  const player = {
    player_id: payload.player_id || makeId("PE"),
    player_name: payload.player_name,
    discord_id: payload.discord_id,
    pubg_ingame_name: payload.pubg_ingame_name || "",
    profile_pic_url: payload.profile_pic_url || "",
    email: payload.email || "",
    region: payload.region || "",
    notes: payload.notes || ""
  };
  players.push(player);
  setCollection("players", players);
  res.status(201).json(player);
});

app.put("/api/admin/players/:id", (req, res) => {
  const players = getCollection("players");
  const id = req.params.id;
  const updated = updateById(players, "player_id", id, (current) => ({
    ...current,
    ...req.body,
    player_id: current.player_id
  }));
  if (!updated) {
    return res.status(404).json({ error: "Player not found" });
  }
  setCollection("players", players);
  res.json(updated);
});

app.delete("/api/admin/players/:id", (req, res) => {
  const players = getCollection("players");
  const filtered = players.filter((item) => item.player_id !== req.params.id);
  if (filtered.length === players.length) {
    return res.status(404).json({ error: "Player not found" });
  }
  setCollection("players", filtered);
  res.status(204).send();
});

app.get("/api/admin/teams", (req, res) => {
  res.json(getCollection("teams"));
});

app.post("/api/admin/teams", (req, res) => {
  const teams = getCollection("teams");
  const payload = req.body || {};
  const team = {
    team_id: payload.team_id || makeId("TE"),
    team_key: payload.team_key || nanoid(12),
    team_name: payload.team_name,
    team_logo_url: payload.team_logo_url || "",
    captain_player_id: payload.captain_player_id,
    player_ids: payload.player_ids || [],
    discord_contact: payload.discord_contact || "",
    region: payload.region || "",
    notes: payload.notes || ""
  };
  teams.push(team);
  setCollection("teams", teams);
  res.status(201).json(team);
});

app.put("/api/admin/teams/:id", (req, res) => {
  const teams = getCollection("teams");
  const id = req.params.id;
  const updated = updateById(teams, "team_id", id, (current) => ({
    ...current,
    ...req.body,
    team_id: current.team_id
  }));
  if (!updated) {
    return res.status(404).json({ error: "Team not found" });
  }
  setCollection("teams", teams);
  res.json(updated);
});

app.delete("/api/admin/teams/:id", (req, res) => {
  const teams = getCollection("teams");
  const filtered = teams.filter((item) => item.team_id !== req.params.id);
  if (filtered.length === teams.length) {
    return res.status(404).json({ error: "Team not found" });
  }
  setCollection("teams", filtered);
  res.status(204).send();
});

app.get("/api/admin/matches", (req, res) => {
  res.json(getCollection("matches"));
});

app.post("/api/admin/matches", (req, res) => {
  const matches = getCollection("matches");
  const payload = req.body || {};
  const match = {
    match_id: payload.match_id || nanoid(10),
    tournament_id: payload.tournament_id,
    match_name: payload.match_name,
    match_time: payload.match_time,
    teams: payload.teams || [],
    result_summary: payload.result_summary || "",
    winner: payload.winner || "",
    placement: payload.placement || []
  };
  matches.push(match);
  setCollection("matches", matches);
  res.status(201).json(match);
});

app.put("/api/admin/matches/:id", (req, res) => {
  const matches = getCollection("matches");
  const id = req.params.id;
  const updated = updateById(matches, "match_id", id, (current) => ({
    ...current,
    ...req.body,
    match_id: current.match_id
  }));
  if (!updated) {
    return res.status(404).json({ error: "Match not found" });
  }
  setCollection("matches", matches);
  res.json(updated);
});

app.delete("/api/admin/matches/:id", (req, res) => {
  const matches = getCollection("matches");
  const filtered = matches.filter((item) => item.match_id !== req.params.id);
  if (filtered.length === matches.length) {
    return res.status(404).json({ error: "Match not found" });
  }
  setCollection("matches", filtered);
  res.status(204).send();
});

app.get("/api/admin/participants", (req, res) => {
  res.json(getCollection("participants"));
});

app.post("/api/admin/participants", (req, res) => {
  const participants = getCollection("participants");
  const payload = req.body || {};
  const participant = {
    participant_id: payload.participant_id || nanoid(10),
    tournament_id: payload.tournament_id,
    type: payload.type,
    linked_player_id: payload.linked_player_id || null,
    linked_team_id: payload.linked_team_id || null,
    status: payload.status || "pending",
    payment_status: payload.payment_status || "unpaid",
    slot_number: payload.slot_number || null,
    notes: payload.notes || ""
  };
  participants.push(participant);
  setCollection("participants", participants);
  res.status(201).json(participant);
});

app.put("/api/admin/participants/:id", (req, res) => {
  const participants = getCollection("participants");
  const id = req.params.id;
  const updated = updateById(participants, "participant_id", id, (current) => ({
    ...current,
    ...req.body,
    participant_id: current.participant_id
  }));
  if (!updated) {
    return res.status(404).json({ error: "Participant not found" });
  }
  setCollection("participants", participants);
  res.json(updated);
});

app.delete("/api/admin/participants/:id", (req, res) => {
  const participants = getCollection("participants");
  const filtered = participants.filter((item) => item.participant_id !== req.params.id);
  if (filtered.length === participants.length) {
    return res.status(404).json({ error: "Participant not found" });
  }
  setCollection("participants", filtered);
  res.status(204).send();
});

app.get("/api/admin/winners", (req, res) => {
  res.json(getCollection("winners"));
});

app.post("/api/admin/winners", (req, res) => {
  const winners = getCollection("winners");
  const payload = req.body || {};
  const record = {
    winner_id: payload.winner_id || nanoid(10),
    tournament_id: payload.tournament_id,
    tournament_name: payload.tournament_name,
    by_points: payload.by_points || null,
    most_kills: payload.most_kills || null
  };
  winners.push(record);
  setCollection("winners", winners);
  res.status(201).json(record);
});

app.put("/api/admin/winners/:id", (req, res) => {
  const winners = getCollection("winners");
  const id = req.params.id;
  const updated = updateById(winners, "winner_id", id, (current) => ({
    ...current,
    ...req.body,
    winner_id: current.winner_id
  }));
  if (!updated) {
    return res.status(404).json({ error: "Winner record not found" });
  }
  setCollection("winners", winners);
  res.json(updated);
});

app.delete("/api/admin/winners/:id", (req, res) => {
  const winners = getCollection("winners");
  const filtered = winners.filter((item) => item.winner_id !== req.params.id);
  if (filtered.length === winners.length) {
    return res.status(404).json({ error: "Winner record not found" });
  }
  setCollection("winners", filtered);
  res.status(204).send();
});

app.get("/api/admin/announcements", (req, res) => {
  res.json(getCollection("announcements"));
});

app.post("/api/admin/announcements", (req, res) => {
  const announcements = getCollection("announcements");
  const payload = req.body || {};
  const announcement = {
    announcement_id: payload.announcement_id || nanoid(10),
    title: payload.title,
    body: payload.body,
    type: payload.type || "notice",
    importance: payload.importance || "medium",
    created_at: payload.created_at || new Date().toISOString()
  };
  announcements.push(announcement);
  setCollection("announcements", announcements);
  res.status(201).json(announcement);
});

app.put("/api/admin/announcements/:id", (req, res) => {
  const announcements = getCollection("announcements");
  const id = req.params.id;
  const updated = updateById(announcements, "announcement_id", id, (current) => ({
    ...current,
    ...req.body,
    announcement_id: current.announcement_id
  }));
  if (!updated) {
    return res.status(404).json({ error: "Announcement not found" });
  }
  setCollection("announcements", announcements);
  res.json(updated);
});

app.delete("/api/admin/announcements/:id", (req, res) => {
  const announcements = getCollection("announcements");
  const filtered = announcements.filter((item) => item.announcement_id !== req.params.id);
  if (filtered.length === announcements.length) {
    return res.status(404).json({ error: "Announcement not found" });
  }
  setCollection("announcements", filtered);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

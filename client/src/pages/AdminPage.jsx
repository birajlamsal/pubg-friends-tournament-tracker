import { useEffect, useMemo, useState } from "react";
import {
  adminLogin,
  adminFetchParticipants,
  adminFetchPlayers,
  adminFetchTeams,
  adminFetchTournaments,
  adminFetchAnnouncements,
  adminCreateParticipant,
  adminCreatePlayer,
  adminCreateTeam,
  adminCreateTournament,
  adminCreateAnnouncement,
  adminDeleteParticipant,
  adminDeletePlayer,
  adminDeleteTeam,
  adminDeleteTournament,
  adminDeleteAnnouncement,
  adminUpdateParticipant,
  adminUpdatePlayer,
  adminUpdateTeam,
  adminUpdateTournament,
  adminUpdateAnnouncement
} from "../api";

const emptyTournament = {
  tournament_id: "",
  name: "",
  description: "",
  banner_url: "",
  start_date: "",
  end_date: "",
  status: "upcoming",
  registration_status: "closed",
  mode: "squad",
  match_type: "classic",
  perspective: "TPP",
  prize_pool: "",
  registration_charge: "",
  featured: false,
  max_slots: "",
  region: "",
  rules: "",
  api_key_required: false,
  custom_match_mode: false,
  allow_non_custom: false,
  custom_player_names: "",
  custom_match_ids: ""
};

const emptyPlayer = {
  player_id: "",
  player_name: "",
  discord_id: "",
  pubg_ingame_name: "",
  profile_pic_url: "",
  email: "",
  region: "",
  notes: ""
};

const emptyTeam = {
  team_id: "",
  team_key: "",
  team_name: "",
  team_logo_url: "",
  captain_player_id: "",
  player_ids: "",
  discord_contact: "",
  region: "",
  notes: ""
};

const emptyParticipant = {
  participant_id: "",
  tournament_id: "",
  type: "team",
  linked_player_id: "",
  linked_team_id: "",
  status: "pending",
  payment_status: "unpaid",
  slot_number: "",
  notes: ""
};

const emptyAnnouncement = {
  announcement_id: "",
  title: "",
  body: "",
  type: "notice",
  importance: "medium"
};

const regions = Array.from(
  new Set(["SEA", "EU", "NA", "SA", "OCE", "MEA", "ASIA", "KRJP", "CN", "Other"])
);

const formatPlayerNames = (value) => {
  if (!value) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
};

const formatMatchIds = (value) => {
  if (!value) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
};

const AdminPage = () => {
  const [token, setToken] = useState(() => localStorage.getItem("adminToken") || "");
  const [login, setLogin] = useState({ username: "admin", password: "admin" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [tournaments, setTournaments] = useState([]);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const [activeTab, setActiveTab] = useState("tournaments");
  const [tournamentForm, setTournamentForm] = useState(emptyTournament);
  const [playerForm, setPlayerForm] = useState(emptyPlayer);
  const [teamForm, setTeamForm] = useState(emptyTeam);
  const [participantForm, setParticipantForm] = useState(emptyParticipant);
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncement);
  const [showTournamentForm, setShowTournamentForm] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [tournamentView, setTournamentView] = useState("list");
  const [bulkParticipant, setBulkParticipant] = useState({
    type: "team",
    ids: "",
    status: "confirmed",
    payment_status: "paid"
  });
  const [teamRoster, setTeamRoster] = useState({
    team_id: "",
    player_ids: "",
    status: "confirmed",
    payment_status: "paid"
  });

  const isEditingTournament = Boolean(tournamentForm.tournament_id && tournaments.length);
  const isEditingPlayer = Boolean(playerForm.player_id && players.length);
  const isEditingTeam = Boolean(teamForm.team_id && teams.length);
  const isEditingParticipant = Boolean(participantForm.participant_id && participants.length);
  const isEditingAnnouncement = Boolean(
    announcementForm.announcement_id && announcements.length
  );

  const selectedTournament = useMemo(() => {
    return tournaments.find((tournament) => tournament.tournament_id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const loadData = async (tokenValue) => {
    setLoading(true);
    try {
      const [tData, pData, teamData, partData, announceData] = await Promise.all([
        adminFetchTournaments(tokenValue),
        adminFetchPlayers(tokenValue),
        adminFetchTeams(tokenValue),
        adminFetchParticipants(tokenValue),
        adminFetchAnnouncements(tokenValue)
      ]);
      setTournaments(tData);
      setPlayers(pData);
      setTeams(teamData);
      setParticipants(partData);
      setAnnouncements(announceData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadData(token);
    }
  }, [token]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const result = await adminLogin(login);
      localStorage.setItem("adminToken", result.token);
      setToken(result.token);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setToken("");
  };

  const onSubmitTournament = async (event) => {
    event.preventDefault();
    setError("");
    if (tournamentForm.start_date && tournamentForm.end_date) {
      const start = new Date(tournamentForm.start_date);
      const end = new Date(tournamentForm.end_date);
      if (
        Number.isFinite(start.getTime()) &&
        Number.isFinite(end.getTime()) &&
        end < start
      ) {
        setError("End date cannot be before start date.");
        return;
      }
    }
    try {
      const { tournament_id, contact_discord, pubg_tournament_id, ...rest } =
        tournamentForm;
      const payload = {
        ...rest,
        prize_pool: Number(tournamentForm.prize_pool || 0),
        registration_charge: Number(tournamentForm.registration_charge || 0),
        max_slots: tournamentForm.max_slots ? Number(tournamentForm.max_slots) : null,
        custom_player_names: tournamentForm.custom_player_names
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
        custom_match_ids: tournamentForm.custom_match_ids
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      };
      if (isEditingTournament) {
        await adminUpdateTournament(token, tournamentForm.tournament_id, payload);
      } else {
        await adminCreateTournament(token, payload);
      }
      setTournamentForm(emptyTournament);
      setShowTournamentForm(false);
      await loadData(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const onSubmitPlayer = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (isEditingPlayer) {
        await adminUpdatePlayer(token, playerForm.player_id, playerForm);
      } else {
        await adminCreatePlayer(token, playerForm);
      }
      setPlayerForm(emptyPlayer);
      setShowPlayerForm(false);
      await loadData(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const onSubmitTeam = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        ...teamForm,
        player_ids: teamForm.player_ids
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      };
      if (isEditingTeam) {
        await adminUpdateTeam(token, teamForm.team_id, payload);
      } else {
        await adminCreateTeam(token, payload);
      }
      setTeamForm(emptyTeam);
      setShowTeamForm(false);
      await loadData(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const onSubmitParticipant = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        ...participantForm,
        slot_number: participantForm.slot_number
          ? Number(participantForm.slot_number)
          : null
      };
      if (isEditingParticipant) {
        await adminUpdateParticipant(token, participantForm.participant_id, payload);
      } else {
        await adminCreateParticipant(token, payload);
      }
      setParticipantForm(emptyParticipant);
      await loadData(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const onSubmitAnnouncement = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        ...announcementForm,
        created_at: announcementForm.created_at || new Date().toISOString()
      };
      if (isEditingAnnouncement) {
        await adminUpdateAnnouncement(token, announcementForm.announcement_id, payload);
      } else {
        await adminCreateAnnouncement(token, payload);
      }
      setAnnouncementForm(emptyAnnouncement);
      await loadData(token);
    } catch (err) {
      setError(err.message);
    }
  };

  const nextTeamSlot = (currentParticipants) => {
    const taken = new Set(
      currentParticipants
        .filter((participant) => participant.type === "team")
        .map((participant) => participant.slot_number)
        .filter(Boolean)
    );
    for (let slot = 1; slot <= 25; slot += 1) {
      if (!taken.has(slot)) {
        return slot;
      }
    }
    return null;
  };

  const addBulkParticipants = async (override = {}) => {
    if (!selectedTournamentId) {
      return;
    }
    const participantConfig = { ...bulkParticipant, ...override };
    const ids = bulkParticipant.ids
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (!ids.length) {
      setError("Enter at least one ID.");
      return;
    }
    const invalidIds = ids.filter((id) =>
      participantConfig.type === "team"
        ? !rosterNames.teamMap.has(id)
        : !rosterNames.playerMap.has(id)
    );
    if (invalidIds.length) {
      setError(`Invalid ${participantConfig.type} ID(s): ${invalidIds.join(", ")}`);
      return;
    }
    setError("");
    setLoading(true);
    try {
      let currentParticipants = [...participants];
      for (const id of ids) {
        const slotNumber =
          participantConfig.type === "team" ? nextTeamSlot(currentParticipants) : null;
        await adminCreateParticipant(token, {
          tournament_id: selectedTournamentId,
          type: participantConfig.type,
          linked_player_id: participantConfig.type === "player" ? id : null,
          linked_team_id: participantConfig.type === "team" ? id : null,
          status: participantConfig.status,
          payment_status: participantConfig.payment_status,
          slot_number: slotNumber
        });
        if (participantConfig.type === "team" && slotNumber) {
          currentParticipants = [
            ...currentParticipants,
            { type: "team", slot_number: slotNumber }
          ];
        }
      }
      setBulkParticipant((prev) => ({ ...prev, ids: "" }));
      await loadData(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const rosterNames = useMemo(() => {
    const playerMap = new Map(players.map((player) => [player.player_id, player.player_name]));
    const teamMap = new Map(teams.map((team) => [team.team_id, team.team_name]));
    return { playerMap, teamMap };
  }, [players, teams]);

  const tournamentParticipants = useMemo(() => {
    if (!selectedTournamentId) {
      return { players: [], teams: [] };
    }
    const related = participants.filter(
      (participant) => participant.tournament_id === selectedTournamentId
    );
    return {
      players: related.filter((participant) => participant.type === "player"),
      teams: related.filter((participant) => participant.type === "team")
    };
  }, [participants, selectedTournamentId]);

  const groupedPlayers = useMemo(() => {
    const groups = new Map();
    tournamentParticipants.players.forEach((participant) => {
      const teamId = participant.notes?.startsWith("team:")
        ? participant.notes.replace("team:", "")
        : "Unassigned";
      if (!groups.has(teamId)) {
        groups.set(teamId, []);
      }
      groups.get(teamId).push(participant);
    });
    return groups;
  }, [tournamentParticipants.players]);

  const tournamentDays = (tournament) => {
    if (!tournament?.start_date || !tournament?.end_date) {
      return "-";
    }
    const start = new Date(tournament.start_date);
    const end = new Date(tournament.end_date);
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return Number.isFinite(diff) ? diff : "-";
  };

  if (!token) {
    return (
      <main className="admin-page">
        <section className="admin-login">
          <h1>Admin Login</h1>
          <p>Use the admin credentials to manage tournaments and rosters.</p>
          {error && <div className="alert">{error}</div>}
          <form onSubmit={handleLogin}>
            <label>
              Username
              <input
                type="text"
                value={login.username}
                onChange={(event) =>
                  setLogin((prev) => ({ ...prev, username: event.target.value }))
                }
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={login.password}
                onChange={(event) =>
                  setLogin((prev) => ({ ...prev, password: event.target.value }))
                }
              />
            </label>
            <button className="primary-button" type="submit">
              Sign In
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <div>
          <h1>Admin Control Room</h1>
          <p>Manage tournaments, players, teams, and participants.</p>
        </div>
        <div className="admin-actions">
          <button className="ghost-button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </section>

      <section className="admin-tabs">
        {[
          { id: "tournaments", label: "Tournaments" },
          { id: "players", label: "Registered Players" },
          { id: "teams", label: "Registered Teams" },
          { id: "announcements", label: "Announcements" }
        ].map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === "tournaments") {
                setTournamentView("list");
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {error && <div className="alert">{error}</div>}
      {loading && <div className="empty-state">Loading admin data...</div>}

      {!loading && activeTab === "tournaments" && (
        <section className="admin-section">
          <div className="admin-list">
            <div className="admin-list-header">
              <h3>Tournaments</h3>
              <div className="admin-list-actions">
                <button
                  className={tournamentView === "list" ? "primary-button" : "ghost-button"}
                  type="button"
                  onClick={() => setTournamentView("list")}
                >
                  List
                </button>
                <button
                  className={tournamentView === "details" ? "primary-button" : "ghost-button"}
                  type="button"
                  onClick={() => {
                    if (!selectedTournamentId && tournaments[0]?.tournament_id) {
                      setSelectedTournamentId(tournaments[0].tournament_id);
                    }
                    setTournamentView("details");
                  }}
                >
                  Details
                </button>
                <button
                  className={
                    tournamentView === "participants" ? "primary-button" : "ghost-button"
                  }
                  type="button"
                  onClick={() => {
                    if (!selectedTournamentId && tournaments[0]?.tournament_id) {
                      setSelectedTournamentId(tournaments[0].tournament_id);
                    }
                    setTournamentView("participants");
                  }}
                >
                  Participants
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setTournamentForm(emptyTournament);
                    setShowTournamentForm(true);
                  }}
                >
                  Add Tournament
                </button>
              </div>
            </div>

            {tournamentView === "list" && (
              <div className="table-wrapper admin-table">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>ID</th>
                      <th>Status</th>
                      <th>Mode</th>
                      <th>FP/TPP</th>
                      <th>Registration</th>
                      <th>Prize Pool</th>
                      <th>Start Date</th>
                      <th>Days</th>
                      <th>Featured</th>
                      <th>Region</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournaments.map((tournament) => (
                      <tr key={tournament.tournament_id}>
                        <td>{tournament.name}</td>
                        <td>{tournament.tournament_id}</td>
                        <td>{tournament.status}</td>
                        <td>{tournament.mode}</td>
                        <td>{tournament.perspective || "TPP"}</td>
                        <td>{tournament.registration_status}</td>
                        <td>${tournament.prize_pool}</td>
                        <td>{tournament.start_date || "-"}</td>
                        <td>{tournamentDays(tournament)}</td>
                        <td>{tournament.featured ? "Yes" : "No"}</td>
                        <td>{tournament.region || "-"}</td>
                        <td>
                          <div className="admin-list-actions">
                            <button
                              className="text-button"
                              onClick={() => {
                                setTournamentForm({
                                  ...emptyTournament,
                                  ...tournament,
                                  custom_player_names: formatPlayerNames(
                                    tournament.custom_player_names
                                  ),
                                  custom_match_ids: formatMatchIds(tournament.custom_match_ids)
                                });
                                setShowTournamentForm(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="text-button danger"
                              onClick={async () => {
                                await adminDeleteTournament(token, tournament.tournament_id);
                                await loadData(token);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tournaments.length === 0 && (
                  <div className="empty-state">No tournaments yet.</div>
                )}
              </div>
            )}
          </div>

          {showTournamentForm && (
            <div className="admin-form">
              <div className="admin-form-header">
                <h2>{isEditingTournament ? "Edit Tournament" : "Create Tournament"}</h2>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setTournamentForm(emptyTournament);
                    setShowTournamentForm(false);
                  }}
                >
                  Close
                </button>
              </div>
              <form onSubmit={onSubmitTournament}>
                <div className="form-grid">
                  <label>
                    Name
                    <input
                      value={tournamentForm.name}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={tournamentForm.status}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({ ...prev, status: event.target.value }))
                      }
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </label>
                  <label>
                    Registration
                    <select
                      value={tournamentForm.registration_status}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          registration_status: event.target.value
                        }))
                      }
                    >
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label>
                    Mode
                    <select
                      value={tournamentForm.mode}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({ ...prev, mode: event.target.value }))
                      }
                    >
                      <option value="solo">Solo</option>
                      <option value="duo">Duo</option>
                      <option value="squad">Squad</option>
                    </select>
                  </label>
                  <label>
                    Match Type
                    <select
                      value={tournamentForm.match_type || "classic"}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          match_type: event.target.value
                        }))
                      }
                    >
                      <option value="classic">Classic</option>
                      <option value="team_deathmatch">Team Deathmatch</option>
                    </select>
                  </label>
                  <label>
                    FP / TPP
                    <select
                      value={tournamentForm.perspective || "TPP"}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          perspective: event.target.value
                        }))
                      }
                    >
                      <option value="FPP">FPP</option>
                      <option value="TPP">TPP</option>
                    </select>
                  </label>
                  <label>
                    Start Date
                    <input
                      type="date"
                      value={tournamentForm.start_date}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          start_date: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    End Date
                    <input
                      type="date"
                      value={tournamentForm.end_date}
                      min={tournamentForm.start_date || undefined}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({ ...prev, end_date: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Prize Pool
                    <input
                      type="number"
                      value={tournamentForm.prize_pool}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          prize_pool: event.target.value
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Registration Charge
                    <input
                      type="number"
                      value={tournamentForm.registration_charge}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          registration_charge: event.target.value
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Max Slots
                    <input
                      type="number"
                      value={tournamentForm.max_slots}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          max_slots: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    Featured
                    <select
                      value={tournamentForm.featured ? "true" : "false"}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          featured: event.target.value === "true"
                        }))
                      }
                    >
                      <option value="false">False</option>
                      <option value="true">True</option>
                    </select>
                  </label>
                  <label>
                    Region
                    <select
                      value={tournamentForm.region}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({ ...prev, region: event.target.value }))
                      }
                    >
                      <option value="">Select region</option>
                      {regions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Banner URL
                    <input
                      value={tournamentForm.banner_url}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          banner_url: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    API Key Required
                    <select
                      value={tournamentForm.api_key_required ? "true" : "false"}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          api_key_required: event.target.value === "true"
                        }))
                      }
                    >
                      <option value="false">False</option>
                      <option value="true">True</option>
                    </select>
                  </label>
                  <label>
                    Custom Match Mode
                    <select
                      value={tournamentForm.custom_match_mode ? "true" : "false"}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          custom_match_mode: event.target.value === "true"
                        }))
                      }
                    >
                      <option value="false">False</option>
                      <option value="true">True</option>
                    </select>
                  </label>
                  <label>
                    Custom Match Player Names
                    <input
                      value={tournamentForm.custom_player_names}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          custom_player_names: event.target.value
                        }))
                      }
                      placeholder="player1, player2, player3"
                    />
                  </label>
                  <label>
                    Custom Match IDs
                    <input
                      value={tournamentForm.custom_match_ids}
                      onChange={(event) =>
                        setTournamentForm((prev) => ({
                          ...prev,
                          custom_match_ids: event.target.value
                        }))
                      }
                      placeholder="match-uuid-1, match-uuid-2"
                    />
                  </label>
                </div>
                <label>
                  Description
                  <textarea
                    value={tournamentForm.description}
                    onChange={(event) =>
                      setTournamentForm((prev) => ({
                        ...prev,
                        description: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  Rules
                  <textarea
                    value={tournamentForm.rules}
                    onChange={(event) =>
                      setTournamentForm((prev) => ({ ...prev, rules: event.target.value }))
                    }
                  />
                </label>
                <div className="form-actions">
                  <button className="primary-button" type="submit">
                    {isEditingTournament ? "Save Changes" : "Create Tournament"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setTournamentForm(emptyTournament)}
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {!loading && activeTab === "tournaments" && tournamentView === "details" && (
        <section className="admin-section">
          <div className="admin-form">
            <div className="admin-form-header">
              <h2>Tournament Details</h2>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setTournamentView("list")}
              >
                Back to list
              </button>
            </div>
            <label>
              Tournament
              <select
                value={selectedTournamentId}
                onChange={(event) => setSelectedTournamentId(event.target.value)}
              >
                <option value="">Select a tournament</option>
                {tournaments.map((tournament) => (
                  <option key={tournament.tournament_id} value={tournament.tournament_id}>
                    {tournament.name} ({tournament.tournament_id})
                  </option>
                ))}
              </select>
            </label>
            {!selectedTournament ? (
              <div className="empty-state">Select a tournament from the list.</div>
            ) : (
              <div className="detail-stack">
                <div className="detail-row">
                  <div>
                    <strong>{selectedTournament.name}</strong>
                    <span className="muted">{selectedTournament.tournament_id}</span>
                  </div>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      setTournamentForm({ ...emptyTournament, ...selectedTournament });
                      setShowTournamentForm(true);
                      setTournamentView("list");
                    }}
                  >
                    Edit Tournament
                  </button>
                </div>
                <div className="detail-grid">
                  <div>
                    <span className="muted">Prize Pool</span>
                    <strong>${selectedTournament.prize_pool}</strong>
                  </div>
                  <div>
                    <span className="muted">Status</span>
                    <strong>{selectedTournament.status}</strong>
                  </div>
                  <div>
                    <span className="muted">Mode</span>
                    <strong>{selectedTournament.mode}</strong>
                  </div>
                  <div>
                    <span className="muted">Match Type</span>
                    <strong>{selectedTournament.match_type || "classic"}</strong>
                  </div>
                  <div>
                    <span className="muted">FP / TPP</span>
                    <strong>{selectedTournament.perspective || "TPP"}</strong>
                  </div>
                  <div>
                    <span className="muted">Registration</span>
                    <strong>{selectedTournament.registration_status}</strong>
                  </div>
                  <div>
                    <span className="muted">Start Date</span>
                    <strong>{selectedTournament.start_date || "-"}</strong>
                  </div>
                  <div>
                    <span className="muted">Days</span>
                    <strong>{tournamentDays(selectedTournament)}</strong>
                  </div>
                  <div>
                    <span className="muted">Registration Charge</span>
                    <strong>${selectedTournament.registration_charge}</strong>
                  </div>
                  <div>
                    <span className="muted">Featured</span>
                    <strong>{selectedTournament.featured ? "Yes" : "No"}</strong>
                  </div>
                  <div>
                    <span className="muted">Region</span>
                    <strong>{selectedTournament.region || "-"}</strong>
                  </div>
                </div>
                {selectedTournament.banner_url && (
                  <div className="banner-preview">
                    <img src={selectedTournament.banner_url} alt={selectedTournament.name} />
                  </div>
                )}
                {selectedTournament.api_key_required &&
                  selectedTournament.custom_match_mode &&
                  (!selectedTournament.custom_player_names ||
                    selectedTournament.custom_player_names.length === 0) &&
                  (!selectedTournament.custom_match_ids ||
                    selectedTournament.custom_match_ids.length === 0) && (
                    <div className="alert">
                      Custom match mode needs match IDs or tracked player names.
                    </div>
                  )}
              </div>
            )}
          </div>

        </section>
      )}

      {!loading && activeTab === "tournaments" && tournamentView === "participants" && (
        <section className="admin-section admin-section--stack">
          <div className="admin-form">
            <div className="admin-form-header">
              <h2>Tournament Participants</h2>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setTournamentView("list")}
              >
                Back to list
              </button>
            </div>
            <label>
              Tournament
              <select
                value={selectedTournamentId}
                onChange={(event) => setSelectedTournamentId(event.target.value)}
              >
                <option value="">Select a tournament</option>
                {tournaments.map((tournament) => (
                  <option key={tournament.tournament_id} value={tournament.tournament_id}>
                    {tournament.name} ({tournament.tournament_id})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-form">
            <h3>Add Team</h3>
            <div className="form-grid">
              <label>
                Team IDs (comma separated)
                <input
                  value={bulkParticipant.ids}
                  onChange={(event) =>
                    setBulkParticipant((prev) => ({ ...prev, ids: event.target.value }))
                  }
                  placeholder="TE12345, TE67890"
                  disabled={!selectedTournamentId}
                />
              </label>
              <label>
                Status
                <select
                  value={bulkParticipant.status}
                  onChange={(event) =>
                    setBulkParticipant((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label>
                Status
                <select
                  value={bulkParticipant.status}
                  onChange={(event) =>
                    setBulkParticipant((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  addBulkParticipants({
                    ...bulkParticipant,
                    type: "team"
                  })
                }
                disabled={!selectedTournamentId}
              >
                Add Team
              </button>
            </div>
          </div>

          <div className="admin-list">
            <h3>Registered Teams</h3>
            <div className="table-wrapper admin-table">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Team ID</th>
                    <th>Team Name</th>
                    <th>Captain</th>
                    <th>Region</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team.team_id}>
                      <td>
                        <span className="id-text">{team.team_id || "-"}</span>
                      </td>
                      <td>{team.team_name}</td>
                      <td>{team.captain_player_id}</td>
                      <td>{team.region || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teams.length === 0 && <div className="empty-state">No teams registered.</div>}
            </div>
          </div>

          <div className="admin-form">
            <h3>Add Players To Team</h3>
            <div className="form-grid">
              <label>
                Team ID
                <input
                  value={teamRoster.team_id}
                  onChange={(event) =>
                    setTeamRoster((prev) => ({ ...prev, team_id: event.target.value }))
                  }
                  placeholder="TE12345"
                  disabled={!selectedTournamentId}
                />
              </label>
              <label>
                Player IDs (comma separated)
                <input
                  value={teamRoster.player_ids}
                  onChange={(event) =>
                    setTeamRoster((prev) => ({ ...prev, player_ids: event.target.value }))
                  }
                  placeholder="PE12345, PE67890"
                  disabled={!selectedTournamentId}
                />
              </label>
              <label>
                Status
                <select
                  value={teamRoster.status}
                  onChange={(event) =>
                    setTeamRoster((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button
                className="primary-button"
                type="button"
                onClick={async () => {
                  if (!selectedTournamentId) {
                    return;
                  }
                  const teamExists = rosterNames.teamMap.has(teamRoster.team_id);
                  if (!teamExists) {
                    setError("Team ID does not exist in registered teams.");
                    return;
                  }
                  const teamInTournament = tournamentParticipants.teams.some(
                    (participant) => participant.linked_team_id === teamRoster.team_id
                  );
                  if (!teamInTournament) {
                    setError("Team is not registered in this tournament.");
                    return;
                  }
                  const ids = teamRoster.player_ids
                    .split(",")
                    .map((id) => id.trim())
                    .filter(Boolean);
                  if (!teamRoster.team_id || !ids.length) {
                    setError("Enter a team ID and at least one player ID.");
                    return;
                  }
                  const invalidPlayers = ids.filter((id) => !rosterNames.playerMap.has(id));
                  if (invalidPlayers.length) {
                    setError(`Invalid player ID(s): ${invalidPlayers.join(", ")}`);
                    return;
                  }
                  setError("");
                  setLoading(true);
                  try {
                    for (const id of ids) {
                      await adminCreateParticipant(token, {
                        tournament_id: selectedTournamentId,
                        type: "player",
                        linked_player_id: id,
                        linked_team_id: null,
                        status: teamRoster.status,
                        payment_status: teamRoster.payment_status,
                        slot_number: null,
                        notes: `team:${teamRoster.team_id}`
                      });
                    }
                    setTeamRoster((prev) => ({ ...prev, player_ids: "" }));
                    await loadData(token);
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={!selectedTournamentId}
              >
                Add Team Players
              </button>
            </div>
          </div>

          <div className="admin-list">
            <h3>Players in Tournament (Grouped by Team)</h3>
            {tournamentParticipants.players.length === 0 && (
              <div className="empty-state">No registered players yet.</div>
            )}
            {Array.from(groupedPlayers.entries()).map(([teamId, playersInTeam]) => (
              <div key={teamId} className="group-card">
                <div className="group-header">
                  <strong>
                    {teamId === "Unassigned"
                      ? "Unassigned Players"
                      : `${rosterNames.teamMap.get(teamId) || teamId}`}
                  </strong>
                  <span className="muted">{teamId !== "Unassigned" ? teamId : ""}</span>
                </div>
                <div className="table-wrapper admin-table">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Player ID</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playersInTeam.map((participant) => (
                        <tr key={participant.participant_id}>
                          <td>
                            {rosterNames.playerMap.get(participant.linked_player_id) || "-"}
                          </td>
                          <td>{participant.linked_player_id}</td>
                          <td>{participant.status}</td>
                          <td>
                            <div className="admin-list-actions">
                              <button
                                className="text-button"
                                onClick={() =>
                                  setParticipantForm({
                                    ...emptyParticipant,
                                    ...participant,
                                    linked_player_id: participant.linked_player_id || "",
                                    linked_team_id: participant.linked_team_id || "",
                                    slot_number: participant.slot_number || ""
                                  })
                                }
                              >
                                Edit
                              </button>
                              <button
                                className="text-button danger"
                                onClick={async () => {
                                  await adminDeleteParticipant(token, participant.participant_id);
                                  await loadData(token);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="admin-list">
            <h3>Teams in Tournament</h3>
            <div className="table-wrapper admin-table">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Team ID</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tournamentParticipants.teams.map((participant) => (
                    <tr key={participant.participant_id}>
                      <td>{rosterNames.teamMap.get(participant.linked_team_id) || "-"}</td>
                      <td>{participant.linked_team_id}</td>
                      <td>{participant.status}</td>
                      <td>
                        <div className="admin-list-actions">
                          <button
                            className="text-button"
                            onClick={() =>
                              setParticipantForm({
                                ...emptyParticipant,
                                ...participant,
                                linked_player_id: participant.linked_player_id || "",
                                linked_team_id: participant.linked_team_id || "",
                                slot_number: participant.slot_number || ""
                              })
                            }
                          >
                            Edit
                          </button>
                          <button
                            className="text-button danger"
                            onClick={async () => {
                              await adminDeleteParticipant(token, participant.participant_id);
                              await loadData(token);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tournamentParticipants.teams.length === 0 && (
                <div className="empty-state">No registered teams yet.</div>
              )}
            </div>
          </div>
        </section>
      )}

      {!loading && activeTab === "players" && (
        <section className="admin-section">
          <div className="admin-list">
            <div className="admin-list-header">
              <h3>Players</h3>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setPlayerForm(emptyPlayer);
                  setShowPlayerForm(true);
                }}
              >
                Add Player
              </button>
            </div>
            <div className="table-wrapper admin-table">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Player ID</th>
                    <th>Profile</th>
                    <th>Name</th>
                    <th>Discord</th>
                    <th>Region</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.player_id}>
                      <td>
                        <span className="id-text">{player.player_id || "-"}</span>
                      </td>
                      <td>
                        <div className="player-thumb">
                          {player.profile_pic_url ? (
                            <img src={player.profile_pic_url} alt={player.player_name} />
                          ) : (
                            <span>{player.player_name?.slice(0, 2)}</span>
                          )}
                        </div>
                      </td>
                      <td>{player.player_name}</td>
                      <td>{player.discord_id}</td>
                      <td>{player.region || "-"}</td>
                      <td>
                        <div className="admin-list-actions">
                          <button
                            className="text-button"
                            onClick={() => {
                              setPlayerForm({ ...emptyPlayer, ...player });
                              setShowPlayerForm(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="text-button danger"
                            onClick={async () => {
                              await adminDeletePlayer(token, player.player_id);
                              await loadData(token);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {players.length === 0 && <div className="empty-state">No players yet.</div>}
            </div>
          </div>

          {showPlayerForm && (
            <div className="admin-form">
              <div className="admin-form-header">
                <h2>{isEditingPlayer ? "Edit Player" : "Create Player"}</h2>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setPlayerForm(emptyPlayer);
                    setShowPlayerForm(false);
                  }}
                >
                  Close
                </button>
              </div>
              <form onSubmit={onSubmitPlayer}>
                <div className="form-grid">
                  <label>
                    Player ID (immutable)
                    <input
                      value={playerForm.player_id}
                      onChange={(event) =>
                        setPlayerForm((prev) => ({ ...prev, player_id: event.target.value }))
                      }
                      placeholder="Auto-generated"
                      disabled
                    />
                  </label>
                  <label>
                    Player Name
                    <input
                      value={playerForm.player_name}
                      onChange={(event) =>
                        setPlayerForm((prev) => ({ ...prev, player_name: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Discord ID
                    <input
                      value={playerForm.discord_id}
                      onChange={(event) =>
                        setPlayerForm((prev) => ({ ...prev, discord_id: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    PUBG IGN
                    <input
                      value={playerForm.pubg_ingame_name}
                      onChange={(event) =>
                        setPlayerForm((prev) => ({
                          ...prev,
                          pubg_ingame_name: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    Profile Pic URL
                    <input
                      value={playerForm.profile_pic_url}
                      onChange={(event) =>
                        setPlayerForm((prev) => ({
                          ...prev,
                          profile_pic_url: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    Email
                    <input
                      value={playerForm.email}
                      onChange={(event) =>
                        setPlayerForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Region
                    <select
                      value={playerForm.region}
                      onChange={(event) =>
                        setPlayerForm((prev) => ({ ...prev, region: event.target.value }))
                      }
                    >
                      <option value="">Select region</option>
                      {regions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Notes
                  <textarea
                    value={playerForm.notes}
                    onChange={(event) =>
                      setPlayerForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                  />
                </label>
                <div className="form-actions">
                  <button className="primary-button" type="submit">
                    {isEditingPlayer ? "Save Changes" : "Create Player"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setPlayerForm(emptyPlayer)}
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {!loading && activeTab === "teams" && (
        <section className="admin-section">
          <div className="admin-list">
            <div className="admin-list-header">
              <h3>Teams</h3>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setTeamForm(emptyTeam);
                  setShowTeamForm(true);
                }}
              >
                Add Team
              </button>
            </div>
            <div className="table-wrapper admin-table">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Team ID</th>
                    <th>Logo</th>
                    <th>Team Name</th>
                    <th>Captain</th>
                    <th>Region</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team.team_id}>
                      <td>
                        <span className="id-text">{team.team_id || "-"}</span>
                      </td>
                      <td>
                        <div className="team-thumb">
                          {team.team_logo_url ? (
                            <img src={team.team_logo_url} alt={team.team_name} />
                          ) : (
                            <span>{team.team_name?.slice(0, 2)}</span>
                          )}
                        </div>
                      </td>
                      <td>{team.team_name}</td>
                      <td>{team.captain_player_id}</td>
                      <td>{team.region || "-"}</td>
                      <td>
                        <div className="admin-list-actions">
                          <button
                            className="text-button"
                            onClick={() => {
                              setTeamForm({
                                ...emptyTeam,
                                ...team,
                                player_ids: (team.player_ids || []).join(", ")
                              });
                              setShowTeamForm(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="text-button danger"
                            onClick={async () => {
                              await adminDeleteTeam(token, team.team_id);
                              await loadData(token);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teams.length === 0 && <div className="empty-state">No teams yet.</div>}
            </div>
          </div>

          {showTeamForm && (
            <div className="admin-form">
              <div className="admin-form-header">
                <h2>{isEditingTeam ? "Edit Team" : "Create Team"}</h2>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setTeamForm(emptyTeam);
                    setShowTeamForm(false);
                  }}
                >
                  Close
                </button>
              </div>
              <form onSubmit={onSubmitTeam}>
                <div className="form-grid">
                  <label>
                    Team ID (immutable)
                    <input
                      value={teamForm.team_id}
                      onChange={(event) =>
                        setTeamForm((prev) => ({ ...prev, team_id: event.target.value }))
                      }
                      placeholder="Auto-generated"
                      disabled
                    />
                  </label>
                  <label>
                    Team Key
                    <input
                      value={teamForm.team_key}
                      onChange={(event) =>
                        setTeamForm((prev) => ({ ...prev, team_key: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Team Name
                    <input
                      value={teamForm.team_name}
                      onChange={(event) =>
                        setTeamForm((prev) => ({ ...prev, team_name: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Team Logo URL
                    <input
                      value={teamForm.team_logo_url}
                      onChange={(event) =>
                        setTeamForm((prev) => ({
                          ...prev,
                          team_logo_url: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    Captain Player ID
                    <input
                      value={teamForm.captain_player_id}
                      onChange={(event) =>
                        setTeamForm((prev) => ({
                          ...prev,
                          captain_player_id: event.target.value
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Player IDs (comma separated)
                    <input
                      value={teamForm.player_ids}
                      onChange={(event) =>
                        setTeamForm((prev) => ({ ...prev, player_ids: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Discord Contact
                    <input
                      value={teamForm.discord_contact}
                      onChange={(event) =>
                        setTeamForm((prev) => ({
                          ...prev,
                          discord_contact: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    Region
                    <select
                      value={teamForm.region}
                      onChange={(event) =>
                        setTeamForm((prev) => ({ ...prev, region: event.target.value }))
                      }
                    >
                      <option value="">Select region</option>
                      {regions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Notes
                  <textarea
                    value={teamForm.notes}
                    onChange={(event) =>
                      setTeamForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                  />
                </label>
                <div className="form-actions">
                  <button className="primary-button" type="submit">
                    {isEditingTeam ? "Save Changes" : "Create Team"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setTeamForm(emptyTeam)}
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {!loading && activeTab === "announcements" && (
        <section className="admin-section">
          <div className="admin-form">
            <h2>{isEditingAnnouncement ? "Edit Announcement" : "Create Announcement"}</h2>
            <form onSubmit={onSubmitAnnouncement}>
              <div className="form-grid">
                <label>
                  Title
                  <input
                    value={announcementForm.title}
                    onChange={(event) =>
                      setAnnouncementForm((prev) => ({
                        ...prev,
                        title: event.target.value
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Type
                  <select
                    value={announcementForm.type}
                    onChange={(event) =>
                      setAnnouncementForm((prev) => ({ ...prev, type: event.target.value }))
                    }
                  >
                    <option value="notice">Notice</option>
                    <option value="update">Update</option>
                    <option value="alert">Alert</option>
                  </select>
                </label>
                <label>
                  Importance
                  <select
                    value={announcementForm.importance}
                    onChange={(event) =>
                      setAnnouncementForm((prev) => ({
                        ...prev,
                        importance: event.target.value
                      }))
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </div>
              <label>
                Body
                <textarea
                  value={announcementForm.body}
                  onChange={(event) =>
                    setAnnouncementForm((prev) => ({ ...prev, body: event.target.value }))
                  }
                  required
                />
              </label>
              <div className="form-actions">
                <button className="primary-button" type="submit">
                  {isEditingAnnouncement ? "Save Changes" : "Publish Announcement"}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setAnnouncementForm(emptyAnnouncement)}
                >
                  Clear
                </button>
              </div>
            </form>
          </div>

          <div className="admin-list">
            <h3>Announcements</h3>
            <div className="table-wrapper admin-table">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((note) => (
                    <tr key={note.announcement_id}>
                      <td>{note.title}</td>
                      <td>{note.type}</td>
                      <td>{new Date(note.created_at).toLocaleString()}</td>
                      <td>
                        <div className="admin-list-actions">
                          <button
                            className="text-button"
                            onClick={() =>
                              setAnnouncementForm({
                                ...emptyAnnouncement,
                                ...note
                              })
                            }
                          >
                            Edit
                          </button>
                          <button
                            className="text-button danger"
                            onClick={async () => {
                              await adminDeleteAnnouncement(token, note.announcement_id);
                              await loadData(token);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {announcements.length === 0 && (
                <div className="empty-state">No announcements yet.</div>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

export default AdminPage;

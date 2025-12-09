async function getServerStatus(state, adminDb) {
  if (!state.serverStatus) {
    state.serverStatus = await adminDb.command({ serverStatus: 1 });
  }

  return state.serverStatus;
}

async function getReplStatus(state, adminDb) {
  if (state.replStatus !== undefined) {
    return state.replStatus;
  }

  try {
    state.replStatus = await adminDb.command({ replSetGetStatus: 1 });
  } catch (error) {
    state.replStatus = null;
    state.replStatusError = error;
  }

  return state.replStatus;
}

async function getDbStats(state, db, scale = 1024 * 1024) {
  if (!state.dbStats) {
    state.dbStats = await db.command({ dbStats: 1, scale });
  }

  return state.dbStats;
}

async function getCurrentOps(state, adminDb) {
  if (!state.currentOps) {
    const response = await adminDb.command({ currentOp: 1, $all: true });
    state.currentOps = Array.isArray(response.inprog) ? response.inprog : [];
  }

  return state.currentOps;
}

module.exports = {
  getServerStatus,
  getReplStatus,
  getDbStats,
  getCurrentOps,
};

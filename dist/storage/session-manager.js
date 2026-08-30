"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const workspace_manager_1 = require("./workspace-manager");
const compatibility_layer_1 = require("../server/compatibility-layer");
const output_channel_1 = require("../logging/output-channel");
class SessionManager {
    static instance;
    sessions = [];
    currentVersion = 1;
    constructor() {
        this.loadSessions();
    }
    static getInstance() {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }
    getSessionsDir(rootPath) {
        const root = rootPath || workspace_manager_1.WorkspaceManager.getInstance().getWorkspaceRoot() || process.cwd();
        return path.join(root, 'trafficghost', 'sessions');
    }
    loadSessions(rootPath) {
        const sessionsDir = this.getSessionsDir(rootPath);
        const metaFile = path.join(sessionsDir, 'sessions.json');
        if (fs.existsSync(metaFile)) {
            try {
                const raw = fs.readFileSync(metaFile, 'utf-8');
                this.sessions = JSON.parse(raw);
                const current = this.sessions.find((s) => s.isCurrent);
                if (current) {
                    this.currentVersion = current.version;
                }
            }
            catch (err) {
                output_channel_1.logger.error(`Error loading session metadata: ${err}`);
            }
        }
        return this.sessions;
    }
    saveSessionsMetadata(rootPath) {
        const sessionsDir = this.getSessionsDir(rootPath);
        if (!fs.existsSync(sessionsDir)) {
            fs.mkdirSync(sessionsDir, { recursive: true });
        }
        const metaFile = path.join(sessionsDir, 'sessions.json');
        fs.writeFileSync(metaFile, JSON.stringify(this.sessions, null, 2), 'utf-8');
    }
    /**
     * Creates and archives a new version of the current Ghost Session.
     */
    createSessionVersion(schema, name = 'Ghost Session', description = 'Application Ghost Session snapshot', requestsCount = 0, rootPath) {
        const nextVer = this.sessions.length > 0
            ? Math.max(...this.sessions.map((s) => s.version)) + 1
            : 1;
        // Mark previous sessions as not current
        this.sessions.forEach((s) => (s.isCurrent = false));
        const newSession = {
            id: `session_v${nextVer}_${Date.now()}`,
            name: `${name} (v${nextVer})`,
            version: nextVer,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            description,
            schema,
            recordedRequestsCount: requestsCount,
            isCurrent: true
        };
        this.sessions.unshift(newSession);
        this.currentVersion = nextVer;
        // Write version directory
        const sessionsDir = this.getSessionsDir(rootPath);
        const verDir = path.join(sessionsDir, `v${nextVer}`);
        if (!fs.existsSync(verDir)) {
            fs.mkdirSync(verDir, { recursive: true });
        }
        fs.writeFileSync(path.join(verDir, 'schema.json'), JSON.stringify(schema, null, 2), 'utf-8');
        this.saveSessionsMetadata(rootPath);
        output_channel_1.logger.info(`Created Ghost Session v${nextVer}: ${newSession.name}`);
        return newSession;
    }
    /**
     * Switches the active Ghost Session to a specific version.
     */
    switchSessionVersion(version) {
        const target = this.sessions.find((s) => s.version === version);
        if (!target)
            return null;
        this.sessions.forEach((s) => (s.isCurrent = s.version === version));
        this.currentVersion = version;
        this.saveSessionsMetadata();
        // Also update main schema
        workspace_manager_1.WorkspaceManager.getInstance().saveSchema(target.schema);
        output_channel_1.logger.info(`Switched active Ghost Session to v${version}`);
        return target;
    }
    /**
     * Computes differences between two schemas.
     */
    computeDiff(oldSchema, newSchema) {
        const addedRest = [];
        const removedRest = [];
        const modifiedRest = [];
        for (const newEp of newSchema.restEndpoints) {
            const oldEp = oldSchema.restEndpoints.find((e) => e.method === newEp.method && e.pathPattern === newEp.pathPattern);
            if (!oldEp) {
                addedRest.push(newEp);
            }
            else {
                const changes = [];
                if (JSON.stringify(oldEp.defaultResponse.body) !== JSON.stringify(newEp.defaultResponse.body)) {
                    changes.push('Response body modified');
                }
                if (oldEp.defaultResponse.statusCode !== newEp.defaultResponse.statusCode) {
                    changes.push(`Status changed: ${oldEp.defaultResponse.statusCode} -> ${newEp.defaultResponse.statusCode}`);
                }
                if (changes.length > 0) {
                    modifiedRest.push({ oldEndpoint: oldEp, newEndpoint: newEp, changes });
                }
            }
        }
        for (const oldEp of oldSchema.restEndpoints) {
            const stillExists = newSchema.restEndpoints.some((e) => e.method === oldEp.method && e.pathPattern === oldEp.pathPattern);
            if (!stillExists) {
                removedRest.push(oldEp);
            }
        }
        // GraphQL Diffs
        const addedGql = [];
        const removedGql = [];
        const modifiedGql = [];
        for (const newGql of newSchema.graphqlEndpoints) {
            const oldGql = oldSchema.graphqlEndpoints.find((g) => g.operationName.toLowerCase() === newGql.operationName.toLowerCase());
            if (!oldGql) {
                addedGql.push(newGql);
            }
            else if (JSON.stringify(oldGql.defaultResponse.body) !== JSON.stringify(newGql.defaultResponse.body)) {
                modifiedGql.push({
                    oldEndpoint: oldGql,
                    newEndpoint: newGql,
                    changes: ['GraphQL response body modified']
                });
            }
        }
        for (const oldGql of oldSchema.graphqlEndpoints) {
            const stillExists = newSchema.graphqlEndpoints.some((g) => g.operationName.toLowerCase() === oldGql.operationName.toLowerCase());
            if (!stillExists) {
                removedGql.push(oldGql);
            }
        }
        const summaryParts = [
            `+ ${addedRest.length} new REST endpoints`,
            `+ ${addedGql.length} new GraphQL operations`,
            `~ ${modifiedRest.length + modifiedGql.length} modified endpoints`,
            `- ${removedRest.length + removedGql.length} removed`
        ];
        return {
            addedRestEndpoints: addedRest,
            removedRestEndpoints: removedRest,
            modifiedRestEndpoints: modifiedRest,
            addedGraphQLEndpoints: addedGql,
            removedGraphQLEndpoints: removedGql,
            modifiedGraphQLEndpoints: modifiedGql,
            summaryText: summaryParts.join(' | ')
        };
    }
    /**
     * Incrementally adds a newly captured endpoint to the active session without losing existing state.
     */
    incrementallyAddEndpoint(currentSchema, newEndpoint) {
        const updated = JSON.parse(JSON.stringify(currentSchema));
        if ('pathPattern' in newEndpoint) {
            // REST Endpoint
            const idx = updated.restEndpoints.findIndex((e) => e.method === newEndpoint.method && e.pathPattern === newEndpoint.pathPattern);
            if (idx >= 0) {
                // Merge response fields
                const existingBody = updated.restEndpoints[idx].defaultResponse.body;
                const mergedBody = compatibility_layer_1.CompatibilityLayer.mergeResponseFields(existingBody, newEndpoint.defaultResponse.body);
                updated.restEndpoints[idx].defaultResponse.body = mergedBody;
                updated.restEndpoints[idx].requestCount += newEndpoint.requestCount;
            }
            else {
                updated.restEndpoints.push(newEndpoint);
            }
        }
        else {
            // GraphQL Endpoint
            const idx = updated.graphqlEndpoints.findIndex((g) => g.operationName.toLowerCase() === newEndpoint.operationName.toLowerCase());
            if (idx >= 0) {
                const existingBody = updated.graphqlEndpoints[idx].defaultResponse.body;
                const mergedBody = compatibility_layer_1.CompatibilityLayer.mergeResponseFields(existingBody, newEndpoint.defaultResponse.body);
                updated.graphqlEndpoints[idx].defaultResponse.body = mergedBody;
                updated.graphqlEndpoints[idx].requestCount += newEndpoint.requestCount;
            }
            else {
                updated.graphqlEndpoints.push(newEndpoint);
            }
        }
        updated.generatedAt = new Date().toISOString();
        workspace_manager_1.WorkspaceManager.getInstance().saveSchema(updated);
        const session = this.createSessionVersion(updated, 'Ghost Session', `Incrementally added ${'pathPattern' in newEndpoint ? newEndpoint.pathPattern : newEndpoint.operationName}`, updated.restEndpoints.length + updated.graphqlEndpoints.length);
        return { updatedSchema: updated, session };
    }
    getSessions() {
        return [...this.sessions];
    }
    getCurrentSession() {
        return this.sessions.find((s) => s.isCurrent) || this.sessions[0];
    }
}
exports.SessionManager = SessionManager;
//# sourceMappingURL=session-manager.js.map
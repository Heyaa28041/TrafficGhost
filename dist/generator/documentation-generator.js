"use strict";
/**
 * Generates markdown documentation for API schemas based on captured endpoint metrics.
 *
 * Connected to:
 *   - src/extension.ts (commands: generateDocs)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentationGenerator = void 0;
class DocumentationGenerator {
    static generateMarkdown(schema) {
        const lines = [];
        lines.push(`# TrafficGhost API Documentation`);
        lines.push(`*Generated from captured application traffic on ${new Date().toLocaleDateString()}*`);
        lines.push(`\n---\n`);
        lines.push(`## Summary`);
        lines.push(`- **REST Endpoints:** ${schema.restEndpoints.length}`);
        lines.push(`- **GraphQL Operations:** ${schema.graphqlEndpoints.length}`);
        lines.push(`- **Global Scenario:** ${schema.globalScenario}`);
        lines.push(`\n---\n`);
        if (schema.restEndpoints.length > 0) {
            lines.push(`## REST APIs\n`);
            for (const ep of schema.restEndpoints) {
                lines.push(this.formatRestEndpoint(ep));
            }
        }
        if (schema.graphqlEndpoints.length > 0) {
            lines.push(`## GraphQL Operations\n`);
            for (const g of schema.graphqlEndpoints) {
                lines.push(this.formatGraphQLEndpoint(g));
            }
        }
        return {
            markdown: lines.join('\n'),
            endpointCount: schema.restEndpoints.length,
            graphqlCount: schema.graphqlEndpoints.length,
            generatedAt: new Date().toISOString()
        };
    }
    static formatRestEndpoint(ep) {
        const lines = [];
        lines.push(`### \`${ep.method}\` ${ep.pathPattern}`);
        lines.push(`*Captured requests: ${ep.requestCount}*\n`);
        if (ep.parameters.length > 0) {
            lines.push(`#### Path Parameters`);
            for (const p of ep.parameters) {
                lines.push(`- \`${p.name}\` (${p.inferredType}): e.g. \`${p.sampleValues.slice(0, 3).join('`, `')}\``);
            }
            lines.push('');
        }
        if (ep.queryParameters.length > 0) {
            const nonPag = ep.queryParameters.filter(q => !q.isPagination);
            if (nonPag.length > 0) {
                lines.push(`#### Query Parameters`);
                for (const q of nonPag) {
                    lines.push(`- \`${q.name}\`: e.g. \`${q.sampleValues.slice(0, 3).join('`, `')}\``);
                }
                lines.push('');
            }
        }
        const defaultBody = ep.defaultResponse?.body;
        if (defaultBody !== undefined && defaultBody !== null) {
            lines.push(`#### Default Response (\`${ep.defaultResponse.statusCode}\`)`);
            lines.push(`\`\`\`json\n${this.formatBody(defaultBody, 2)}\n\`\`\`\n`);
        }
        const otherStatuses = [...new Set(ep.responses.map(r => r.statusCode))].filter(s => s !== ep.defaultResponse?.statusCode);
        if (otherStatuses.length > 0) {
            lines.push(`**Other Observed Statuses:** ${otherStatuses.map(s => `\`${s}\``).join(', ')}\n`);
        }
        lines.push(`---\n`);
        return lines.join('\n');
    }
    static formatGraphQLEndpoint(g) {
        const lines = [];
        lines.push(`### GraphQL \`${g.operationType.toUpperCase()}\` ${g.operationName}`);
        lines.push(`*Path: ${g.path} | Captured calls: ${g.requestCount}*\n`);
        if (g.queryText) {
            lines.push(`#### Query`);
            lines.push(`\`\`\`graphql\n${g.queryText}\n\`\`\`\n`);
        }
        const defaultBody = g.defaultResponse?.body;
        if (defaultBody !== undefined && defaultBody !== null) {
            lines.push(`#### Default Response`);
            lines.push(`\`\`\`json\n${this.formatBody(defaultBody, 2)}\n\`\`\`\n`);
        }
        lines.push(`---\n`);
        return lines.join('\n');
    }
    static formatBody(body, indent = 2) {
        try {
            return JSON.stringify(body, null, indent);
        }
        catch {
            return String(body);
        }
    }
}
exports.DocumentationGenerator = DocumentationGenerator;
//# sourceMappingURL=documentation-generator.js.map
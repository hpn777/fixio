import * as fs from 'fs';
import * as xml2js from 'xml2js';

/**
 * Interface for FIX field definition from XML
 */
interface FixField {
  $: {
    number: string;
    name: string;
    type: string;
  };
}

/**
 * Interface for FIX component/group definition from XML
 */
interface FixComponent {
  $: {
    name: string;
    required?: string;
  };
  field?: Array<{ $: { name: string; required?: string } }>;
  group?: Array<{ $: { name: string; required?: string } }>;
  component?: Array<{ $: { name: string; required?: string } }>;
}

/**
 * Interface for FIX group definition from XML
 */
interface FixGroup {
  $: {
    name: string;
    required?: string;
  };
  field?: Array<{ $: { name: string; required?: string } }>;
  group?: Array<{ $: { name: string; required?: string } }>;
  component?: Array<{ $: { name: string; required?: string } }>;
}

/**
 * Converts QuickFIX XML protocol definition to keyvals enum and repeatingGroups object
 */
export class QFixXmlConverter {
  private fields: Map<string, FixField> = new Map();
  private components: Map<string, FixComponent> = new Map();
  private groups: Map<string, FixGroup> = new Map();
  private repeatingGroupsMap: Map<string, Set<string>> = new Map();

  /**
   * Parse QuickFIX XML file and extract field definitions
   */
  async parseXml(xmlFilePath: string): Promise<void> {
    const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');
    const parser = new xml2js.Parser();
    
    const result = await parser.parseStringPromise(xmlContent);
    
    // Extract fields
    if (result.fix?.fields?.[0]?.field) {
      result.fix.fields[0].field.forEach((field: FixField) => {
        this.fields.set(field.$.name, field);
      });
    }

    // Extract components
    if (result.fix?.components?.[0]?.component) {
      result.fix.components[0].component.forEach((component: FixComponent) => {
        this.components.set(component.$.name, component);
      });
    }

    // Extract messages and identify groups
    if (result.fix?.messages?.[0]?.message) {
      result.fix.messages[0].message.forEach((message: any) => {
        this.extractGroups(message);
      });
    }

    // Also check components for groups
    this.components.forEach((component) => {
      this.extractGroups(component);
    });
  }

  /**
   * Extract group definitions from message or component
   */
  private extractGroups(element: any): void {
    if (element.group) {
      element.group.forEach((group: any) => {
        const groupName = group.$.name;
        const groupField = this.getFieldByName(groupName);
        
        if (groupField) {
          const groupNumber = groupField.$.number;
          const memberFields = this.extractGroupMembers(group);
          
          if (memberFields.length > 0) {
            if (!this.repeatingGroupsMap.has(groupNumber)) {
              this.repeatingGroupsMap.set(groupNumber, new Set());
            }
            memberFields.forEach(fieldNum => {
              this.repeatingGroupsMap.get(groupNumber)!.add(fieldNum);
            });
          }
        }

        // Recursively process nested groups
        this.extractGroups(group);
      });
    }

    if (element.component) {
      element.component.forEach((comp: any) => {
        const componentDef = this.components.get(comp.$.name);
        if (componentDef) {
          this.extractGroups(componentDef);
        }
      });
    }
  }

  /**
   * Extract member fields from a group
   */
  private extractGroupMembers(group: any): string[] {
    const members: string[] = [];

    if (group.field) {
      group.field.forEach((field: any) => {
        const fieldDef = this.getFieldByName(field.$.name);
        if (fieldDef) {
          members.push(fieldDef.$.number);
        }
      });
    }

    if (group.component) {
      group.component.forEach((comp: any) => {
        const componentDef = this.components.get(comp.$.name);
        if (componentDef) {
          members.push(...this.getComponentFields(componentDef));
        }
      });
    }

    if (group.group) {
      group.group.forEach((nestedGroup: any) => {
        const groupField = this.getFieldByName(nestedGroup.$.name);
        if (groupField) {
          members.push(groupField.$.number);
        }
      });
    }

    return members;
  }

  /**
   * Get all field numbers from a component
   */
  private getComponentFields(component: FixComponent): string[] {
    const fields: string[] = [];

    if (component.field) {
      component.field.forEach((field) => {
        const fieldDef = this.getFieldByName(field.$.name);
        if (fieldDef) {
          fields.push(fieldDef.$.number);
        }
      });
    }

    if (component.group) {
      component.group.forEach((group) => {
        const groupField = this.getFieldByName(group.$.name);
        if (groupField) {
          fields.push(groupField.$.number);
        }
      });
    }

    if (component.component) {
      component.component.forEach((comp) => {
        const componentDef = this.components.get(comp.$.name);
        if (componentDef) {
          fields.push(...this.getComponentFields(componentDef));
        }
      });
    }

    return fields;
  }

  /**
   * Get field definition by name
   */
  private getFieldByName(name: string): FixField | undefined {
    return this.fields.get(name);
  }

  /**
   * Generate keyvals enum as TypeScript code
   */
  generateKeyvals(): string {
    const sortedFields = Array.from(this.fields.values()).sort(
      (a, b) => parseInt(a.$.number) - parseInt(b.$.number)
    );

    let output = 'export enum keyvals {\n';
    
    sortedFields.forEach((field, index) => {
      const fieldName = this.sanitizeFieldName(field.$.name);
      const fieldNumber = field.$.number;
      
      if (fieldName === '(NotDefined)') {
        output += `  // @ts-ignore\n`;
      }
      
      output += `  "${fieldName}" = ${fieldNumber}`;
      
      if (index < sortedFields.length - 1) {
        output += ',\n';
      } else {
        output += '\n';
      }
    });

    output += '}';
    return output;
  }

  /**
   * Generate repeatingGroups object as TypeScript code
   */
  generateRepeatingGroups(): string {
    const sortedGroups = Array.from(this.repeatingGroupsMap.entries()).sort(
      (a, b) => parseInt(a[0]) - parseInt(b[0])
    );

    let output = 'export const repeatingGroups: Record<string, Array<string>> = {\n';
    
    sortedGroups.forEach(([groupNum, members], index) => {
      const membersArray = Array.from(members).sort(
        (a, b) => parseInt(a) - parseInt(b)
      );
      
      output += `  '${groupNum}': [${membersArray.map(m => `'${m}'`).join(', ')}]`;
      
      if (index < sortedGroups.length - 1) {
        output += ',\n';
      } else {
        output += '\n';
      }
    });

    output += '}';
    return output;
  }

  /**
   * Generate complete fixSchema.ts file content
   */
  generateSchema(): string {
    const repeatingGroups = this.generateRepeatingGroups();
    const keyvals = this.generateKeyvals();
    
    return `${repeatingGroups}\n\n${keyvals}\n`;
  }

  /**
   * Write schema to file
   */
  async writeSchema(outputPath: string): Promise<void> {
    const schema = this.generateSchema();
    fs.writeFileSync(outputPath, schema, 'utf-8');
    console.log(`Schema written to ${outputPath}`);
  }

  /**
   * Sanitize field name for TypeScript enum
   */
  private sanitizeFieldName(name: string): string {
    // Replace invalid characters and handle special cases
    return name
      .replace(/\s+/g, '')
      .replace(/[()]/g, match => match === '(' ? '(' : ')')
      .replace(/\//g, 'Or');
  }
}

/**
 * CLI function to convert XML to schema
 */
export async function convertXmlToSchema(
  xmlFilePath: string,
  outputPath?: string
): Promise<void> {
  const converter = new QFixXmlConverter();
  
  console.log(`Parsing QuickFIX XML file: ${xmlFilePath}`);
  await converter.parseXml(xmlFilePath);
  
  if (outputPath) {
    await converter.writeSchema(outputPath);
  } else {
    console.log('\n=== Repeating Groups ===\n');
    console.log(converter.generateRepeatingGroups());
    console.log('\n=== Key Values ===\n');
    console.log(converter.generateKeyvals());
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: ts-node xmlToSchema.ts <xml-file-path> [output-file-path]');
    console.error('Example: ts-node xmlToSchema.ts FIX44.xml src/resources/fixSchema.ts');
    process.exit(1);
  }

  const [xmlFilePath, outputPath] = args;
  
  convertXmlToSchema(xmlFilePath, outputPath)
    .then(() => {
      console.log('Conversion completed successfully!');
    })
    .catch((error) => {
      console.error('Error during conversion:', error);
      process.exit(1);
    });
}

import { QFixXmlConverter } from '../src/resources/xmlToSchema'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('QFixXmlConverter - Basic Tests', () => {
    let converter: QFixXmlConverter
    let tempDir: string
    let testXmlPath: string

    const minimalFixXml = `<?xml version="1.0" encoding="UTF-8"?>
<fix type="FIX" major="4" minor="4">
  <fields>
    <field number="1" name="Account" type="STRING"/>
    <field number="11" name="ClOrdID" type="STRING"/>
    <field number="35" name="MsgType" type="STRING"/>
    <field number="55" name="Symbol" type="STRING"/>
  </fields>
  <messages>
    <message name="NewOrderSingle" msgtype="D" msgcat="app">
      <field name="ClOrdID" required="Y"/>
      <field name="Symbol" required="Y"/>
    </message>
  </messages>
</fix>`

    beforeEach(() => {
        converter = new QFixXmlConverter()
        tempDir = os.tmpdir()
        testXmlPath = path.join(tempDir, `test-fix-${Date.now()}.xml`)
    })

    afterEach(() => {
        if (fs.existsSync(testXmlPath)) {
            fs.unlinkSync(testXmlPath)
        }
    })

    test('should parse minimal valid FIX XML', async () => {
        fs.writeFileSync(testXmlPath, minimalFixXml, 'utf-8')
        
        await expect(converter.parseXml(testXmlPath)).resolves.not.toThrow()
    })

    test('should extract all field definitions', async () => {
        fs.writeFileSync(testXmlPath, minimalFixXml, 'utf-8')
        await converter.parseXml(testXmlPath)
        
        const keyvals = converter.generateKeyvals()
        
        expect(keyvals).toContain('"Account" = 1')
        expect(keyvals).toContain('"ClOrdID" = 11')
        expect(keyvals).toContain('"MsgType" = 35')
        expect(keyvals).toContain('"Symbol" = 55')
    })

    test('should generate valid TypeScript enum', async () => {
        fs.writeFileSync(testXmlPath, minimalFixXml, 'utf-8')
        await converter.parseXml(testXmlPath)
        
        const keyvals = converter.generateKeyvals()
        
        expect(keyvals).toMatch(/^export enum keyvals \{/)
        expect(keyvals).toMatch(/\}$/)
    })

    test('should write schema to file', async () => {
        fs.writeFileSync(testXmlPath, minimalFixXml, 'utf-8')
        await converter.parseXml(testXmlPath)
        
        const outputPath = path.join(tempDir, `output-${Date.now()}.ts`)
        
        try {
            await converter.writeSchema(outputPath)
            
            expect(fs.existsSync(outputPath)).toBe(true)
            
            const content = fs.readFileSync(outputPath, 'utf-8')
            expect(content).toContain('export const repeatingGroups')
            expect(content).toContain('export enum keyvals')
        } finally {
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath)
            }
        }
    })
})

describe('QFixXmlConverter - Repeating Groups', () => {
    let converter: QFixXmlConverter
    let tempDir: string
    let testXmlPath: string

    const fixXmlWithGroups = `<?xml version="1.0" encoding="UTF-8"?>
<fix type="FIX" major="4" minor="4">
  <fields>
    <field number="78" name="NoAllocs" type="NUMINGROUP"/>
    <field number="79" name="AllocAccount" type="STRING"/>
    <field number="80" name="AllocQty" type="QTY"/>
    <field number="447" name="PartyIDSource" type="CHAR"/>
    <field number="448" name="PartyID" type="STRING"/>
    <field number="452" name="PartyRole" type="INT"/>
    <field number="453" name="NoPartyIDs" type="NUMINGROUP"/>
  </fields>
  <components>
    <component name="Parties">
      <group name="NoPartyIDs" required="N">
        <field name="PartyID" required="N"/>
        <field name="PartyIDSource" required="N"/>
        <field name="PartyRole" required="N"/>
      </group>
    </component>
  </components>
  <messages>
    <message name="NewOrderSingle" msgtype="D" msgcat="app">
      <component name="Parties" required="N"/>
      <group name="NoAllocs" required="N">
        <field name="AllocAccount" required="N"/>
        <field name="AllocQty" required="N"/>
      </group>
    </message>
  </messages>
</fix>`

    const fixXmlWithNestedGroups = `<?xml version="1.0" encoding="UTF-8"?>
<fix type="FIX" major="4" minor="4">
  <fields>
    <field number="78" name="NoAllocs" type="NUMINGROUP"/>
    <field number="79" name="AllocAccount" type="STRING"/>
    <field number="136" name="NoMiscFees" type="NUMINGROUP"/>
    <field number="137" name="MiscFeeAmt" type="AMT"/>
    <field number="138" name="MiscFeeCurr" type="CURRENCY"/>
  </fields>
  <messages>
    <message name="Test" msgtype="D" msgcat="app">
      <group name="NoAllocs" required="N">
        <field name="AllocAccount" required="N"/>
        <group name="NoMiscFees" required="N">
          <field name="MiscFeeAmt" required="N"/>
          <field name="MiscFeeCurr" required="N"/>
        </group>
      </group>
    </message>
  </messages>
</fix>`

    beforeEach(() => {
        converter = new QFixXmlConverter()
        tempDir = os.tmpdir()
        testXmlPath = path.join(tempDir, `test-fix-groups-${Date.now()}.xml`)
    })

    afterEach(() => {
        if (fs.existsSync(testXmlPath)) {
            fs.unlinkSync(testXmlPath)
        }
    })

    test('should detect simple repeating groups', async () => {
        fs.writeFileSync(testXmlPath, fixXmlWithGroups, 'utf-8')
        await converter.parseXml(testXmlPath)
        
        const repeatingGroups = converter.generateRepeatingGroups()
        
        expect(repeatingGroups).toContain("'78'")
        expect(repeatingGroups).toContain("'453'")
    })

    test('should extract correct group members', async () => {
        fs.writeFileSync(testXmlPath, fixXmlWithGroups, 'utf-8')
        await converter.parseXml(testXmlPath)
        
        const repeatingGroups = converter.generateRepeatingGroups()
        
        expect(repeatingGroups).toMatch(/'78':\s*\['79',\s*'80'\]/)
        expect(repeatingGroups).toMatch(/'453':\s*\['447',\s*'448',\s*'452'\]/)
    })

    test('should handle groups from components', async () => {
        fs.writeFileSync(testXmlPath, fixXmlWithGroups, 'utf-8')
        await converter.parseXml(testXmlPath)
        
        const repeatingGroups = converter.generateRepeatingGroups()
        
        expect(repeatingGroups).toContain("'453'")
    })

    test('should handle nested repeating groups', async () => {
        fs.writeFileSync(testXmlPath, fixXmlWithNestedGroups, 'utf-8')
        await converter.parseXml(testXmlPath)
        
        const repeatingGroups = converter.generateRepeatingGroups()
        
        expect(repeatingGroups).toContain("'78'")
        expect(repeatingGroups).toContain("'136'")
        expect(repeatingGroups).toMatch(/'136':\s*\['137',\s*'138'\]/)
    })
})

describe('QFixXmlConverter - Edge Cases', () => {
    let converter: QFixXmlConverter
    let tempDir: string
    let testXmlPath: string

    beforeEach(() => {
        converter = new QFixXmlConverter()
        tempDir = os.tmpdir()
        testXmlPath = path.join(tempDir, `test-fix-edge-${Date.now()}.xml`)
    })

    afterEach(() => {
        if (fs.existsSync(testXmlPath)) {
            fs.unlinkSync(testXmlPath)
        }
    })

    test('should throw error for non-existent file', async () => {
        await expect(
            converter.parseXml('/non/existent/file.xml')
        ).rejects.toThrow()
    })

    test('should throw error for invalid XML', async () => {
        fs.writeFileSync(testXmlPath, '<invalid xml', 'utf-8')
        
        await expect(converter.parseXml(testXmlPath)).rejects.toThrow()
    })

    test('should handle empty fields section', async () => {
        const emptyFieldsXml = `<?xml version="1.0" encoding="UTF-8"?>
<fix>
  <fields/>
  <messages/>
</fix>`
        
        fs.writeFileSync(testXmlPath, emptyFieldsXml, 'utf-8')
        await converter.parseXml(testXmlPath)
        
        const keyvals = converter.generateKeyvals()
        expect(keyvals).toContain('export enum keyvals')
    })

    test('should handle field names with special characters', async () => {
        const specialXml = `<?xml version="1.0" encoding="UTF-8"?>
<fix>
  <fields>
    <field number="101" name="Not Defined" type="STRING"/>
    <field number="102" name="Field/Name" type="STRING"/>
  </fields>
  <messages/>
</fix>`
        
        fs.writeFileSync(testXmlPath, specialXml, 'utf-8')
        await converter.parseXml(testXmlPath)
        
        const keyvals = converter.generateKeyvals()
        
        expect(keyvals).toContain('"NotDefined" = 101')
        expect(keyvals).toContain('"FieldOrName" = 102')
    })

    test('should sort fields by numeric tag', async () => {
        const unsortedXml = `<?xml version="1.0" encoding="UTF-8"?>
<fix>
  <fields>
    <field number="100" name="FieldC" type="STRING"/>
    <field number="1" name="FieldA" type="STRING"/>
    <field number="50" name="FieldB" type="STRING"/>
  </fields>
  <messages/>
</fix>`
        
        fs.writeFileSync(testXmlPath, unsortedXml, 'utf-8')
        await converter.parseXml(testXmlPath)
        
        const keyvals = converter.generateKeyvals()
        const lines = keyvals.split('\n')
        
        const fieldNumbers: number[] = []
        lines.forEach(line => {
            const match = line.match(/= (\d+)/)
            if (match) {
                fieldNumbers.push(parseInt(match[1]))
            }
        })
        
        for (let i = 1; i < fieldNumbers.length; i++) {
            expect(fieldNumbers[i]).toBeGreaterThan(fieldNumbers[i - 1])
        }
    })
})

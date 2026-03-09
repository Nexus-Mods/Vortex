import path from 'path';

export const DEFAULT_MOD_SETTINGS_V8 = `<?xml version="1.0" encoding="UTF-8"?>
<save>
    <version major="4" minor="8" revision="0" build="10"/>
    <region id="ModuleSettings">
        <node id="root">
            <children>
                <node id="Mods">
                    <children>
                        <node id="ModuleShortDesc">
                            <attribute id="Folder" type="LSString" value="GustavX"/>
                            <attribute id="MD5" type="LSString" value=""/>
                            <attribute id="Name" type="LSString" value="GustavX"/>
                            <attribute id="PublishHandle" type="uint64" value="0"/>
                            <attribute id="UUID" type="guid" value="cb555efe-2d9e-131f-8195-a89329d218ea"/>
                            <attribute id="Version64" type="int64" value="36028797018963968"/>
                        </node>
                    </children>
                </node>
            </children>
        </node>
    </region>
</save>`;

export const DEFAULT_MOD_SETTINGS_V7 = `<?xml version="1.0" encoding="UTF-8"?>
<save>
  <version major="4" minor="7" revision="1" build="200"/>
  <region id="ModuleSettings">
    <node id="root">
      <children>
        <node id="Mods">
          <children>
            <node id="ModuleShortDesc">
              <attribute id="Folder" type="LSString" value="GustavDev"/>
              <attribute id="MD5" type="LSString" value=""/>
              <attribute id="Name" type="LSString" value="GustavDev"/>
              <attribute id="PublishHandle" type="uint64" value="0"/>
              <attribute id="UUID" type="guid" value="28ac9ce2-2aba-8cda-b3b5-6e922f71b6b8"/>
              <attribute id="Version64" type="int64" value="36028797018963968"/>
            </node>
          </children>
        </node>
      </children>
    </node>
  </region>
</save>`;

export const DEFAULT_MOD_SETTINGS_V6 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<save>
  <version major="4" minor="0" revision="10" build="100"/>
  <region id="ModuleSettings">
    <node id="root">
      <children>
        <node id="ModOrder">
          <children/>
        </node>
        <node id="Mods">
          <children>
            <node id="ModuleShortDesc">
              <attribute id="Folder" type="LSString" value="GustavDev"/>
              <attribute id="MD5" type="LSString" value=""/>
              <attribute id="Name" type="LSString" value="GustavDev"/>
              <attribute id="UUID" type="FixedString" value="28ac9ce2-2aba-8cda-b3b5-6e922f71b6b8"/>
              <attribute id="Version64" type="int64" value="36028797018963968"/>
            </node>
          </children>
        </node>
      </children>
    </node>
  </region>
</save>`;
export const GAME_ID = 'baldursgate3';
export const DEBUG = false;
export const LSLIB_URL = 'https://github.com/Norbyte/lslib';
export const LO_FILE_NAME = 'loadOrder.json';
export const INVALID_LO_MOD_TYPES = ['bg3-lslib-divine-tool', 'bg3-bg3se', 'bg3-replacer', 'bg3-loose', 'dinput'];

export const IGNORE_PATTERNS = [
  path.join('**', 'info.json'),
];
export const MOD_TYPE_LSLIB = 'bg3-lslib-divine-tool';
export const MOD_TYPE_BG3SE = 'bg3-bg3se';
export const MOD_TYPE_REPLACER = 'bg3-replacer';
export const MOD_TYPE_LOOSE = 'bg3-loose';

export const ORIGINAL_FILES = new Set([
  'assets.pak',
  'assets.pak',
  'effects.pak',
  'engine.pak',
  'engineshaders.pak',
  'game.pak',
  'gameplatform.pak',
  'gustav.pak',
  'gustav_textures.pak',
  'icons.pak',
  'lowtex.pak',
  'materials.pak',
  'minimaps.pak',
  'models.pak',
  'shared.pak',
  'sharedsoundbanks.pak',
  'sharedsounds.pak',
  'textures.pak',
  'virtualtextures.pak',
]);

export const LSLIB_FILES = new Set([
  'divine.exe',
  'lslib.dll',
]);

export const NOTIF_IMPORT_ACTIVITY = 'bg3-loadorder-import-activity';
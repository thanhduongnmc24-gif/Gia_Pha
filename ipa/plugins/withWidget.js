const { withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');
const xcode = require('xcode');
const fs = require('fs');
const path = require('path');

const WIDGET_TARGET_NAME = 'ShiftWidget';
const APP_GROUP_IDENTIFIER = 'group.com.ghichu.widgetdata';

const withWidget = (config) => {
  // 1. Thêm App Group
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.security.application-groups'] = [APP_GROUP_IDENTIFIER];
    return config;
  });

  // 2. Chỉnh sửa Xcode Project (CHẾ ĐỘ THỦ CÔNG 100%)
  config = withXcodeProject(config, async (config) => {
    const projectPath = config.modResults.filepath;
    const project = xcode.project(projectPath);

    project.parse(async function (err) {
      if (err) {
        console.error('Error parsing project:', err);
        return;
      }

      // --- TẠO CÁC ID (UUID) ---
      const targetUuid = project.generateUuid();
      const groupUuid = project.generateUuid();
      const configurationListUuid = project.generateUuid();
      const productFileRefUuid = project.generateUuid(); 
      const sourcesBuildPhaseUuid = project.generateUuid();
      const resourcesBuildPhaseUuid = project.generateUuid();
      const swiftBuildFileUuid = project.generateUuid(); 

      const mainGroup = project.getFirstProject()['firstProject']['mainGroup'];

      // --- COPY FILE ---
      const widgetSourceDir = path.join(__dirname, '../widget');
      const iosDir = path.join(__dirname, '../ios');
      const widgetDestDir = path.join(iosDir, WIDGET_TARGET_NAME);

      if (!fs.existsSync(widgetDestDir)) {
        fs.mkdirSync(widgetDestDir, { recursive: true });
      }

      ['ShiftWidget.swift', 'Info.plist'].forEach((file) => {
        const src = path.join(widgetSourceDir, file);
        const dest = path.join(widgetDestDir, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
        }
      });

      // --- 1. TẠO FILE REFERENCE (.appex) ---
      const productFile = {
        isa: 'PBXFileReference',
        explicitFileType: '"wrapper.app-extension"',
        includeInIndex: 0,
        path: `"${WIDGET_TARGET_NAME}.appex"`,
        sourceTree: 'BUILT_PRODUCTS_DIR'
      };
      // Ghi thẳng vào object
      project.hash.project.objects['PBXFileReference'][productFileRefUuid] = productFile;
      project.hash.project.objects['PBXFileReference'][productFileRefUuid + '_comment'] = WIDGET_TARGET_NAME + '.appex';
      
      // Thêm vào Products Group (Tìm thủ công)
      const pbxGroupSection = project.hash.project.objects['PBXGroup'];
      for (const key in pbxGroupSection) {
          if (pbxGroupSection[key].name === 'Products') {
              pbxGroupSection[key].children.push({ value: productFileRefUuid, comment: WIDGET_TARGET_NAME + '.appex' });
              break;
          }
      }

      // --- 2. ADD FILE VÀO PROJECT (Phần này dùng hàm addFile được vì nó ổn định) ---
      const swiftFile = project.addFile(`${WIDGET_TARGET_NAME}/ShiftWidget.swift`, mainGroup, {});
      const plistFile = project.addFile(`${WIDGET_TARGET_NAME}/Info.plist`, mainGroup, {});

      // Tạo Group Widget
      const widgetGroup = project.addPbxGroup(
        [swiftFile.fileRef, plistFile.fileRef],
        WIDGET_TARGET_NAME,
        WIDGET_TARGET_NAME
      );
      const mainPbxGroup = project.getPBXGroupByKey(mainGroup);
      mainPbxGroup.children.push({ value: widgetGroup.uuid, comment: WIDGET_TARGET_NAME });

      // --- 3. TẠO BUILD FILE (Thủ công) ---
      const swiftBuildFile = {
        isa: 'PBXBuildFile',
        fileRef: swiftFile.fileRef,
        settings: {}
      };
      project.hash.project.objects['PBXBuildFile'][swiftBuildFileUuid] = swiftBuildFile;
      project.hash.project.objects['PBXBuildFile'][swiftBuildFileUuid + '_comment'] = 'ShiftWidget.swift in Sources';

      // --- 4. TẠO BUILD PHASES (Thủ công) ---
      // Sources
      const sourcesPhase = {
        isa: 'PBXSourcesBuildPhase',
        buildActionMask: 2147483647,
        files: [ { value: swiftBuildFileUuid, comment: 'ShiftWidget.swift in Sources' } ],
        runOnlyForDeploymentPostprocessing: 0
      };
      project.hash.project.objects['PBXSourcesBuildPhase'][sourcesBuildPhaseUuid] = sourcesPhase;
      project.hash.project.objects['PBXSourcesBuildPhase'][sourcesBuildPhaseUuid + '_comment'] = 'Sources';

      // Resources
      const resourcesPhase = {
        isa: 'PBXResourcesBuildPhase',
        buildActionMask: 2147483647,
        files: [],
        runOnlyForDeploymentPostprocessing: 0
      };
      project.hash.project.objects['PBXResourcesBuildPhase'][resourcesBuildPhaseUuid] = resourcesPhase;
      project.hash.project.objects['PBXResourcesBuildPhase'][resourcesBuildPhaseUuid + '_comment'] = 'Resources';

      // --- 5. CONFIGURATION LIST ---
      const widgetBundleId = `${config.ios.bundleIdentifier}.${WIDGET_TARGET_NAME}`;
      const buildSettings = {
        INFOPLIST_FILE: `${WIDGET_TARGET_NAME}/Info.plist`,
        PRODUCT_BUNDLE_IDENTIFIER: widgetBundleId,
        SWIFT_VERSION: '5.0',
        IPHONEOS_DEPLOYMENT_TARGET: '17.0',
        TARGETED_DEVICE_FAMILY: '"1"',
        ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon',
        SKIP_INSTALL: 'YES',
        CODE_SIGN_ENTITLEMENTS: `${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`,
        MARKETING_VERSION: '1.0',
        CURRENT_PROJECT_VERSION: '1',
        CODE_SIGNING_ALLOWED: 'NO', 
        CODE_SIGNING_REQUIRED: 'NO',
        CODE_SIGN_IDENTITY: '""',
        DEVELOPMENT_TEAM: '""'
      };

      const xcConfig = {
        isa: 'XCConfigurationList',
        buildConfigurations: [
          {
            name: 'Debug',
            isa: 'XCBuildConfiguration',
            buildSettings: { ...buildSettings, MTL_ENABLE_DEBUG_INFO: 'INCLUDE_SOURCE' },
          },
          {
            name: 'Release',
            isa: 'XCBuildConfiguration',
            buildSettings: { ...buildSettings, MTL_ENABLE_DEBUG_INFO: 'NO' },
          },
        ],
        defaultConfigurationIsVisible: 0,
        defaultConfigurationName: 'Release',
      };
      
      // Đăng ký Configuration List vào Hash
      project.hash.project.objects['XCConfigurationList'][configurationListUuid] = xcConfig;
      project.hash.project.objects['XCConfigurationList'][configurationListUuid + '_comment'] = 'Build configuration list for PBXNativeTarget "' + WIDGET_TARGET_NAME + '"';

      // --- 6. NATIVE TARGET (Thủ công) ---
      const nativeTarget = {
        isa: 'PBXNativeTarget',
        buildConfigurationList: configurationListUuid,
        buildPhases: [
          { value: sourcesBuildPhaseUuid, comment: 'Sources' },
          { value: resourcesBuildPhaseUuid, comment: 'Resources' },
        ],
        buildRules: [],
        dependencies: [],
        name: WIDGET_TARGET_NAME,
        productName: WIDGET_TARGET_NAME,
        productReference: productFileRefUuid,
        productType: '"com.apple.product-type.app-extension"',
      };

      // Đăng ký Target vào Hash
      project.hash.project.objects['PBXNativeTarget'][targetUuid] = nativeTarget;
      project.hash.project.objects['PBXNativeTarget'][targetUuid + '_comment'] = WIDGET_TARGET_NAME;

      // --- 7. LINK TARGET VÀO PROJECT (FIX LỖI CŨ - DÙNG LOOP) ---
      // Đây là đoạn sửa lỗi: Tèo tìm thủ công và Push thẳng vào mảng, KHÔNG dùng hàm thư viện
      const pbxProjectSection = project.hash.project.objects['PBXProject'];
      for (const key in pbxProjectSection) {
          if (!key.endsWith('_comment')) {
              const pbxProject = pbxProjectSection[key];
              pbxProject.targets.push({ value: targetUuid, comment: WIDGET_TARGET_NAME });
              break; // Tìm thấy thì dừng ngay
          }
      }

      // --- 8. ENTITLEMENTS ---
      const entitlementsContent = `
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
            <key>com.apple.security.application-groups</key>
            <array>
                <string>${APP_GROUP_IDENTIFIER}</string>
            </array>
        </dict>
        </plist>
      `;
      fs.writeFileSync(path.join(widgetDestDir, `${WIDGET_TARGET_NAME}.entitlements`), entitlementsContent.trim());
      // Chỉ add file reference, không add vào build phase
      project.addFile(`${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`, widgetGroup.uuid, {});
      
      // Ghi file
      fs.writeFileSync(projectPath, project.writeSync());
    });

    return config;
  });

  return config;
};

module.exports = withWidget;
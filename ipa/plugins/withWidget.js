const { withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');
const xcode = require('xcode');
const fs = require('fs');
const path = require('path');

const WIDGET_TARGET_NAME = 'ShiftWidget';
const APP_GROUP_IDENTIFIER = 'group.com.ghichu.widgetdata';

const withWidget = (config) => {
  // 1. Thêm App Group vào App Chính
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.security.application-groups'] = [APP_GROUP_IDENTIFIER];
    return config;
  });

  // 2. Chỉnh sửa Xcode Project
  config = withXcodeProject(config, async (config) => {
    const projectPath = config.modResults.filepath;
    const project = xcode.project(projectPath);

    project.parse(async function (err) {
      if (err) {
        console.error('Error parsing project:', err);
        return;
      }

      // --- COPY FILE NGUYÊN LIỆU ---
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

      // --- 1. TẠO TARGET (Dùng hàm chuẩn để tạo khung) ---
      // Hàm này tạo Target, ConfigurationList và BuildPhases rỗng
      const target = project.addTarget(WIDGET_TARGET_NAME, 'app_extension', WIDGET_TARGET_NAME);

      // --- 2. TẠO GROUP CHO WIDGET (Thủ công) ---
      const mainGroupUuid = project.getFirstProject()['firstProject']['mainGroup'];
      const mainGroup = project.hash.project.objects['PBXGroup'][mainGroupUuid];
      
      const widgetGroupUuid = project.generateUuid();
      const widgetGroup = {
        isa: 'PBXGroup',
        children: [],
        name: WIDGET_TARGET_NAME,
        sourceTree: '<group>'
      };
      project.hash.project.objects['PBXGroup'][widgetGroupUuid] = widgetGroup;
      project.hash.project.objects['PBXGroup'][widgetGroupUuid + '_comment'] = WIDGET_TARGET_NAME;
      
      // Gắn Group Widget vào Main Group
      mainGroup.children.push({ value: widgetGroupUuid, comment: WIDGET_TARGET_NAME });

      // --- 3. THÊM FILE SWIFT VÀO PROJECT (Thủ công 100%) ---
      // Tạo File Reference
      const swiftFileUuid = project.generateUuid();
      const swiftFileRef = {
        isa: 'PBXFileReference',
        path: `${WIDGET_TARGET_NAME}/ShiftWidget.swift`,
        sourceTree: '<group>',
        fileEncoding: 4,
        lastKnownFileType: 'sourcecode.swift',
        name: 'ShiftWidget.swift'
      };
      project.hash.project.objects['PBXFileReference'][swiftFileUuid] = swiftFileRef;
      project.hash.project.objects['PBXFileReference'][swiftFileUuid + '_comment'] = 'ShiftWidget.swift';
      
      // Thêm vào Group
      widgetGroup.children.push({ value: swiftFileUuid, comment: 'ShiftWidget.swift' });

      // Tạo Build File (Để compile)
      const swiftBuildFileUuid = project.generateUuid();
      const swiftBuildFile = {
        isa: 'PBXBuildFile',
        fileRef: swiftFileUuid,
      };
      project.hash.project.objects['PBXBuildFile'][swiftBuildFileUuid] = swiftBuildFile;
      project.hash.project.objects['PBXBuildFile'][swiftBuildFileUuid + '_comment'] = 'ShiftWidget.swift in Sources';

      // Tìm Sources Build Phase của Target và thêm file vào
      const nativeTarget = project.hash.project.objects['PBXNativeTarget'][target.uuid];
      const sourcesPhaseUuid = nativeTarget.buildPhases.find(phase => {
          const phaseObj = project.hash.project.objects['PBXSourcesBuildPhase'][phase.value];
          return phaseObj; // Chỉ cần tìm thấy UUID là được
      }).value;
      const sourcesPhase = project.hash.project.objects['PBXSourcesBuildPhase'][sourcesPhaseUuid];
      sourcesPhase.files.push({ value: swiftBuildFileUuid, comment: 'ShiftWidget.swift in Sources' });

      // --- 4. THÊM INFO.PLIST (Thủ công) ---
      const plistFileUuid = project.generateUuid();
      const plistFileRef = {
        isa: 'PBXFileReference',
        path: `${WIDGET_TARGET_NAME}/Info.plist`,
        sourceTree: '<group>',
        fileEncoding: 4,
        lastKnownFileType: 'text.plist.xml',
        name: 'Info.plist'
      };
      project.hash.project.objects['PBXFileReference'][plistFileUuid] = plistFileRef;
      project.hash.project.objects['PBXFileReference'][plistFileUuid + '_comment'] = 'Info.plist';
      
      // Thêm vào Group
      widgetGroup.children.push({ value: plistFileUuid, comment: 'Info.plist' });

      // --- 5. ENTITLEMENTS (Thủ công) ---
      const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.security.application-groups</key><array><string>${APP_GROUP_IDENTIFIER}</string></array></dict></plist>`;
      fs.writeFileSync(path.join(widgetDestDir, `${WIDGET_TARGET_NAME}.entitlements`), entitlementsContent.trim());
      
      const entitlementsFileUuid = project.generateUuid();
      const entitlementsFileRef = {
        isa: 'PBXFileReference',
        path: `${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`,
        sourceTree: '<group>',
        fileEncoding: 4,
        lastKnownFileType: 'text.plist.xml',
        name: `${WIDGET_TARGET_NAME}.entitlements`
      };
      project.hash.project.objects['PBXFileReference'][entitlementsFileUuid] = entitlementsFileRef;
      project.hash.project.objects['PBXFileReference'][entitlementsFileUuid + '_comment'] = `${WIDGET_TARGET_NAME}.entitlements`;
      
      widgetGroup.children.push({ value: entitlementsFileUuid, comment: `${WIDGET_TARGET_NAME}.entitlements` });

      // --- 6. CẬP NHẬT BUILD SETTINGS (Quan trọng) ---
      const configurations = project.pbxXCBuildConfigurationSection();
      const widgetBundleId = `${config.ios.bundleIdentifier}.${WIDGET_TARGET_NAME}`;

      for (const key in configurations) {
        if (typeof configurations[key] === 'object') {
          const buildSettings = configurations[key].buildSettings;
          // Chỉ sửa cấu hình của Widget Target
          if (buildSettings['PRODUCT_NAME'] === `"${WIDGET_TARGET_NAME}"` || buildSettings['PRODUCT_NAME'] === WIDGET_TARGET_NAME) {
            
            buildSettings['INFOPLIST_FILE'] = `${WIDGET_TARGET_NAME}/Info.plist`;
            buildSettings['PRODUCT_BUNDLE_IDENTIFIER'] = widgetBundleId;
            buildSettings['SWIFT_VERSION'] = '5.0';
            buildSettings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0';
            buildSettings['TARGETED_DEVICE_FAMILY'] = '"1"'; 
            buildSettings['SKIP_INSTALL'] = 'YES';
            buildSettings['CODE_SIGN_ENTITLEMENTS'] = `${WIDGET_TARGET_NAME}/${WIDGET_TARGET_NAME}.entitlements`;
            buildSettings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon';
            // Tắt Signing cho Github Actions
            buildSettings['CODE_SIGNING_ALLOWED'] = 'NO';
            buildSettings['CODE_SIGNING_REQUIRED'] = 'NO';
            buildSettings['CODE_SIGN_IDENTITY'] = '""';
            buildSettings['DEVELOPMENT_TEAM'] = '""';
          }
        }
      }

      // --- 7. EMBED WIDGET VÀO MAIN APP (Thủ công) ---
      // Lấy ID của file .appex mà hàm addTarget đã tạo ra
      const productFileRefUuid = nativeTarget.productReference;

      if (productFileRefUuid) {
          const embedPhaseUuid = project.generateUuid();
          const productBuildFileUuid = project.generateUuid();
          const containerProxyUuid = project.generateUuid();
          const targetDependencyUuid = project.generateUuid();

          // Tìm Main App Target
          let mainAppTargetKey = null;
          const nativeTargets = project.hash.project.objects['PBXNativeTarget'];
          for (const key in nativeTargets) {
              if (key !== target.uuid && nativeTargets[key].productType === '"com.apple.product-type.application"') {
                  mainAppTargetKey = key;
                  break;
              }
          }

          if (mainAppTargetKey) {
              // Build File cho Embed
              const appexBuildFile = {
                  isa: 'PBXBuildFile',
                  fileRef: productFileRefUuid,
                  settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] }
              };
              project.hash.project.objects['PBXBuildFile'][productBuildFileUuid] = appexBuildFile;
              project.hash.project.objects['PBXBuildFile'][productBuildFileUuid + '_comment'] = `${WIDGET_TARGET_NAME}.appex in Embed App Extensions`;

              // Proxy & Dependency
              const containerProxy = {
                  isa: 'PBXContainerItemProxy',
                  containerPortal: project.hash.project.rootObject,
                  proxyType: 1,
                  remoteGlobalIDString: target.uuid,
                  remoteInfo: WIDGET_TARGET_NAME
              };
              project.hash.project.objects['PBXContainerItemProxy'][containerProxyUuid] = containerProxy;

              const targetDependency = {
                  isa: 'PBXTargetDependency',
                  target: target.uuid,
                  targetProxy: containerProxyUuid
              };
              project.hash.project.objects['PBXTargetDependency'][targetDependencyUuid] = targetDependency;

              // Copy Files Phase
              const copyFilesPhase = {
                  isa: 'PBXCopyFilesBuildPhase',
                  buildActionMask: 2147483647,
                  dstPath: '""',
                  dstSubfolderSpec: 13, // PlugIns
                  files: [{ value: productBuildFileUuid, comment: `${WIDGET_TARGET_NAME}.appex in Embed App Extensions` }],
                  name: '"Embed App Extensions"',
                  runOnlyForDeploymentPostprocessing: 0
              };
              project.hash.project.objects['PBXCopyFilesBuildPhase'][embedPhaseUuid] = copyFilesPhase;

              // Gắn vào Main App
              const mainAppTarget = nativeTargets[mainAppTargetKey];
              
              if (!mainAppTarget.dependencies) mainAppTarget.dependencies = [];
              mainAppTarget.dependencies.push({ value: targetDependencyUuid, comment: 'PBXTargetDependency' });

              if (!mainAppTarget.buildPhases) mainAppTarget.buildPhases = [];
              mainAppTarget.buildPhases.push({ value: embedPhaseUuid, comment: 'Embed App Extensions' });
              
              console.log('✅ WIDGET LINKED & EMBEDDED SUCCESSFULLY!');
          }
      }

      fs.writeFileSync(projectPath, project.writeSync());
    });

    return config;
  });

  return config;
};

module.exports = withWidget;
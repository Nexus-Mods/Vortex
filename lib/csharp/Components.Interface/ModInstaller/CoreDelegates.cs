using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Components.Interface
{
    using SelectCB = Action<int, int, int[]>;
    using ContinueCB = Action<bool>;
    using CancelCB = Action;

    #region Plugin

    public class PluginDelegates
    {
        private Func<object, Task<object>> mGetAll;
        private Func<object, Task<object>> mIsActive;
        private Func<object, Task<object>> mIsPresent;

        public PluginDelegates(dynamic source)
        {
            mGetAll = source.getAll;
            mIsActive = source.isActive;
            mIsPresent = source.isPresent;
        }

        public async Task<string[]> GetAll(bool activeOnly)
        {
            object res = await mGetAll(activeOnly);
            if (res != null)
            {
                return ((IEnumerable)res).Cast<object>()
                                                    .Select(x => x.ToString())
                                                    .ToArray();
            }
            else
                return new string[0];
        }

        public async Task<bool> IsActive(string pluginName)
        {
            object res = await mIsActive(pluginName);
            return (bool)res;
        }

        public async Task<bool> IsPresent(string pluginName)
        {
            object res = await mIsPresent(pluginName);
            return (bool)res;
        }
    }

    #endregion

    #region Ini

    public class IniDelegates
    {
        private Func<object[], Task<object>> mGetIniString;
        private Func<object[], Task<object>> mGetIniInt;

        public IniDelegates(dynamic source)
        {
            mGetIniString = source.getIniString;
            mGetIniInt = source.getIniInt;
        }

        public async Task<string> GetIniString(string iniFileName, string iniSection, string iniKey)
        {
            string[] Params = new string[] { iniFileName, iniSection, iniKey };
            object res = await mGetIniString(Params);
            if (res != null)
            {
                return res.ToString();
            }
            else
                return string.Empty;
        }

        public async Task<int> GetIniInt(string iniFileName, string iniSection, string iniKey)
        {
            string[] Params = new string[] { iniFileName, iniSection, iniKey };
            object res = await mGetIniInt(Params);
            if (res != null)
            {
                return (int)res;
            }
            else
                return -1;
        }
    }

    #endregion

    #region Context

    public class ContextDelegates
    {
        private Func<object, Task<object>> mGetAppVersion;
        private Func<object, Task<object>> mGetCurrentGameVersion;
        private Func<object, Task<object>> mGetExtenderVersion;
        private Func<object, Task<object>> mIsExtenderPresent;
        private Func<object, Task<object>> mCheckIfFileExists;
        private Func<object, Task<object>> mGetExistingDataFile;
        private Func<object[], Task<object>> mGetExistingDataFileList;

        public ContextDelegates(dynamic source)
        {
            mGetAppVersion = source.getAppVersion;
            mGetCurrentGameVersion = source.getCurrentGameVersion;
            mCheckIfFileExists = source.checkIfFileExists;
            mGetExtenderVersion = source.getExtenderVersion;
            mIsExtenderPresent = source.isExtenderPresent;
            mGetExistingDataFile = source.getExistingDataFile;
            mGetExistingDataFileList = source.getExistingDataFileList;
        }

        public async Task<string> GetAppVersion()
        {
            object res = await mGetAppVersion(null);
            return (string)res;
        }

        public async Task<string> GetCurrentGameVersion()
        {
            object res = await mGetCurrentGameVersion(null);
            return (string)res;
        }

        public async Task<string> GetExtenderVersion(string extender)
        {
            object res = await mGetExtenderVersion(extender);
            return (string)res;
        }

        public async Task<bool> IsExtenderPresent()
        {
            object res = await mIsExtenderPresent(null);
            return (bool)res;
        }

        public async Task<bool> CheckIfFileExists(string fileName)
        {
            object res = await mCheckIfFileExists(fileName);
            return (bool)res;
        }

        public async Task<byte[]> GetExistingDataFile(string dataFile)
        {
            object res = await mGetExistingDataFile(dataFile);
            return (byte[])res;
        }

        public async Task<string[]> GetExistingDataFileList(string folderPath, string searchFilter, bool isRecursive)
        {
            object[] Params = new object[] { folderPath, searchFilter, isRecursive };
            object res = await mGetExistingDataFileList(Params);
            return (string[])res;
        }
    }

    #endregion

    #region UI

    public struct HeaderImage
    {
        public string path;
        public bool showFade;
        public int height;

        public HeaderImage(string path, bool showFade, int height) : this()
        {
            this.path = path;
            this.showFade = showFade;
            this.height = height;
        }
    }

    namespace ui
    {
        public struct Option
        {
            public int id;
            public bool selected;
            public string name;
            public string description;
            public string image;

            public Option(int id, string name, string description, string image, bool selected) : this()
            {
                this.id = id;
                this.name = name;
                this.description = description;
                this.image = image;
                this.selected = selected;
            }
        }

        public struct Group
        {
            public int id;
            public string name;
            public string type;
            public Option[] options;

            public Group(int id, string name, string type, Option[] options) : this()
            {
                this.id = id;
                this.name = name;
                this.type = type;
                this.options = options;
            }
        }

        public struct GroupList
        {
            public Group[] group;
            public string order;
        }

        public struct InstallerStep
        {
            public int id;
            public string name;
            public bool visible;
            public GroupList optionalFileGroups;

            public InstallerStep(int id, string name, bool visible) : this()
            {
                this.id = id;
                this.name = name;
                this.visible = visible;
            }
        }

        struct StartParameters
        {
            public string moduleName;
            public HeaderImage image;
            public Func<object, Task<object>> select;
            public Func<object, Task<object>> cont;
            public Func<object, Task<object>> cancel;

            public StartParameters(string moduleName, HeaderImage image, SelectCB select, ContinueCB cont, CancelCB cancel)
            {
                this.moduleName = moduleName;
                this.image = image;
                this.select = async (dynamic selectPar) =>
                {
                    object[] pluginObjs = selectPar.plugins;
                    IEnumerable<int> pluginIds = pluginObjs.Select(id => (int)id);
                    select(selectPar.stepId, selectPar.groupId, pluginIds.ToArray());
                    return await Task.FromResult<object>(null);
                };

                this.cont = async (dynamic direction) =>
                {
                    cont(((string)direction == "forward"));
                    return await Task.FromResult<object>(null);
                };
                this.cancel = async (dynamic dummy) =>
                {
                    cancel();
                    return await Task.FromResult<object>(null);
                };
            }
        }

        struct UpdateParameters
        {
            public InstallerStep[] installSteps;
            public int currentStep;

            public UpdateParameters(InstallerStep[] installSteps, int currentStep)
            {
                this.installSteps = installSteps;
                this.currentStep = currentStep;
            }
        }

        public class Delegates
        {
            private Func<object, Task<object>> mStartDialog;
            private Func<object, Task<object>> mEndDialog;
            private Func<object, Task<object>> mUpdateState;
            private Func<object, Task<object>> mReportError;

            public Delegates(dynamic source)
            {
                mStartDialog = source.startDialog;
                mEndDialog = source.endDialog;
                mUpdateState = source.updateState;
                mReportError = source.reportError;
            }

            public async void StartDialog(string moduleName, HeaderImage image, SelectCB select, ContinueCB cont, CancelCB cancel)
            {
                await mStartDialog(new StartParameters(moduleName, image, select, cont, cancel));
            }

            public async void EndDialog()
            {
                await mEndDialog(null);
            }

            public async void UpdateState(InstallerStep[] installSteps, int currentStep)
            {
                await mUpdateState(new UpdateParameters(installSteps, currentStep));
            }

            public async void ReportError(string title, string message, string details)
            {
                await mReportError(new Dictionary<string, dynamic>
                {
                    { "title", title },
                    { "message", message },
                    { "details", details }
                });
            }
        }
    }

    #endregion

    public class CoreDelegates
    {
        private PluginDelegates mPluginDelegates;
        private ContextDelegates mContextDelegates;
        private IniDelegates mIniDelegates;
        private ui.Delegates mUIDelegates;

        public CoreDelegates(dynamic source)
        {
            mPluginDelegates = new PluginDelegates(source.plugin);
            mIniDelegates = new IniDelegates(source.ini);
            mContextDelegates = new ContextDelegates(source.context);
            mUIDelegates = new ui.Delegates(source.ui);
        }

        public PluginDelegates plugin
        {
            get
            {
                return mPluginDelegates;
            }
        }

        public IniDelegates ini
        {
            get
            {
                return mIniDelegates;
            }
        }

        public ContextDelegates context
        {
            get
            {
                return mContextDelegates;
            }
        }

        public ui.Delegates ui
        {
            get
            {
                return mUIDelegates;
            }
        }
    }
}

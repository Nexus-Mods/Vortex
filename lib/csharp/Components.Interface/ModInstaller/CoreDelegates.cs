using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Components.Interface
{
    using SelectCB = Action<int, int, int[]>;
    using ContinueCB = Action<bool>;
    using CancelCB = Action;

    public class PluginDelegates
    {
        private Func<object, Task<object>> mGetAll;
        private Func<object, Task<object>> mIsActive;
        private Func<object, Task<object>> mIsPresent;

        public PluginDelegates(dynamic source)
        {
            mGetAll = source.GetAll;
            mIsActive = source.isActive;
            mIsPresent = source.isPresent;
        }

        public async Task<string[]> GetAll(bool activeOnly)
        {
            object res = await mGetAll(activeOnly);
            return (string[])res;
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
            int id;
            string name;
            string description;
            string image;

            public Option(int id, string name, string description, string image) : this()
            {
                this.id = id;
                this.name = name;
                this.description = description;
                this.image = image;
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

        public class Delegates
        {
            private Func<object, Task<object>> mStartDialog;
            private Func<object, Task<object>> mEndDialog;
            private Func<object, Task<object>> mUpdateState;

            public Delegates(dynamic source)
            {
                mStartDialog = source.startDialog;
                mEndDialog = source.endDialog;
                mUpdateState = source.updateState;
            }

            public async void StartDialog(string moduleName, HeaderImage image, SelectCB select, ContinueCB cont, CancelCB cancel)
            {
                Func<object, Task<object>> selectWrap = (dynamic selectPar) => select(selectPar.stepId, selectPar.groupId, selectPar.plugins);
                Func<object, Task<object>> contWrap = (dynamic direction) =>
                {
                    cont(((string)direction == "forward"));
                    return null;
                };
                Func<object, Task<object>> cancelWrap = (dynamic dummy) => { cancel(); return null; };
                dynamic par = new object();
                par.moduleName = moduleName;
                par.image = image;
                par.select = selectWrap;
                par["continue"] = contWrap;
                par.cancel = cancelWrap;
                await mStartDialog(par);
            }

            public async void EndDialog()
            {
                await mEndDialog(null);
            }

            public async void UpdateState(InstallerStep[] installSteps, int currentStep)
            {
                dynamic par = new object();
                par.installSteps = installSteps;
                par.currentStep = currentStep;
                await mUpdateState(par);
            }
        }
    }

    public class CoreDelegates
    {
        private PluginDelegates mPluginDelegates;
        private ui.Delegates mUIDelegates;

        public CoreDelegates(dynamic source)
        {
            mPluginDelegates = new PluginDelegates(source.plugin);
            mUIDelegates = new ui.Delegates(source.ui);
        }

        public PluginDelegates plugin
        {
            get
            {
                return mPluginDelegates;
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

using System;
using System.Collections.Generic;
using System.Threading;
using Components.Interface;
using Components.Scripting;
using System.Linq;
using Components.Interface.ui;

namespace Components.Scripting.XmlScript
{
    /// <summary>
    /// Executes an XML script.
    /// </summary>
    public class XmlScriptExecutor : ScriptExecutorBase
    {
        private SynchronizationContext m_scxSyncContext = null;
        private Mod ModArchive = null;
        private CoreDelegates m_Delegates;
        #region Constructors

        /// <summary>
        /// A simple constructor that initializes the object with the required dependencies.
        /// </summary>
        /// <param name="modArchive">The mod object containing the file list in the mod archive.</param>
        /// <param name="UserInteractionDelegate">The utility class to use to install the mod items.</param>
        /// <param name="scxUIContext">The <see cref="SynchronizationContext"/> to use to marshall UI interactions to the UI thread.</param>		
        public XmlScriptExecutor(Mod modArchive, CoreDelegates coreDelegates, SynchronizationContext scxUIContext)
        {
            ModArchive = modArchive;
            m_scxSyncContext = scxUIContext;
            m_Delegates = coreDelegates;
        }

        #endregion

        #region ScriptExecutorBase Members

        /// <summary>
        /// Executes the script.
        /// </summary>
        /// <param name="scpScript">The XMl Script to execute.</param>
        /// <returns><c>true</c> if the script completes successfully;
        /// <c>false</c> otherwise.</returns>
        /// <exception cref="ArgumentException">Thrown if <paramref name="scpScript"/> is not an
        /// <see cref="XmlScript"/>.</exception>
        public override bool DoExecute(IScript scpScript)
        {
            List<InstallableFile> FilesToInstall = new List<InstallableFile>();
            List<InstallableFile> PluginsToActivate = new List<InstallableFile>();
            
            if (!(scpScript is XmlScript))
                throw new ArgumentException("The given script must be of type XmlScript.", scpScript.Type.TypeName);

            XmlScript xscScript = (XmlScript)scpScript;

            ConditionStateManager csmStateManager = ((XmlScriptType)xscScript.Type).CreateConditionStateManager();
            if ((xscScript.ModPrerequisites != null) && !xscScript.ModPrerequisites.GetIsFulfilled(csmStateManager))
                throw new Exception(xscScript.ModPrerequisites.GetMessage(csmStateManager));

            IList<InstallStep> lstSteps = xscScript.InstallSteps;
            HeaderInfo hifHeaderInfo = xscScript.HeaderInfo;
            if (string.IsNullOrEmpty(hifHeaderInfo.ImagePath))
                hifHeaderInfo.ImagePath = ModArchive.ScreenshotPath;
            if ((hifHeaderInfo.Height < 0) && hifHeaderInfo.ShowImage)
                hifHeaderInfo.Height = 75;

            Action<int, int, int[]> select = (int stepId, int groupId, int[] optionIds) =>
            {
                ISet<int> selectedIds = new HashSet<int>(optionIds);
                IList<Option> options = lstSteps[stepId].OptionGroups[groupId].Options;
                for (int i = 0; i < options.Count; ++i)
                {
                    if (selectedIds.Contains(i))
                    {
                        options[i].Flags.ForEach((ConditionalFlag flag) =>
                        {
                            csmStateManager.SetFlagValue(flag.Name, flag.ConditionalValue, options[i]);
                        });
                    } else
                    {
                        csmStateManager.RemoveFlags(options[i]);
                    }
                }
            };

            int stepIdx = 0;

            Action<bool> cont = (bool forward) => {
                if (forward)
                {
                    stepIdx = findNextIdx(lstSteps, csmStateManager, stepIdx);
                } else
                {
                    stepIdx = findPrevIdx(lstSteps, csmStateManager, stepIdx);
                }

                if (stepIdx == -1)
                {
                    m_Delegates.ui.endDialog();
                    XmlScriptInstaller xsiInstaller = new XmlScriptInstaller(ModArchive);
                    // ??? OnTaskStarted(xsiInstaller);
                    xsiInstaller.Install(xscScript, csmStateManager, FilesToInstall, PluginsToActivate);
                }
                sendState(lstSteps, csmStateManager, stepIdx);
            };
            Action cancel = () => { };

            m_Delegates.ui.startDialog(hifHeaderInfo.Title,
                new HeaderImage(hifHeaderInfo.ImagePath, hifHeaderInfo.ShowFade, hifHeaderInfo.Height),
                select, cont, cancel);

            sendState(lstSteps, csmStateManager, stepIdx);

            return false;
        }
 
        private void sendState(IList<InstallStep> lstSteps, ConditionStateManager csmStateManager, int stepIdx)
        {
            Func<IEnumerable<InstallStep>, IEnumerable<InstallerStep>> convertSteps = steps =>
            {
                int idx = 0;
                return steps.Select(step => new InstallerStep(idx++, step.Name, step.VisibilityCondition.GetIsFulfilled(csmStateManager)));
            };

            Func<IEnumerable<Option>, IEnumerable<Interface.ui.Option>> convertOptions = options =>
            {
                int idx = 0;
                return options.Select(option => new Interface.ui.Option(idx++, option.Name, option.Description, option.ImagePath));
            };

            Func<IEnumerable<OptionGroup>, IEnumerable<Group>> convertGroups = groups =>
            {
                int idx = 0;
                return groups.Select(group => new Group(idx++, group.Name, group.Type.ToString(), convertOptions(group.Options).ToArray()));
            };

            Action<InstallerStep[], int> insertGroups = (InstallerStep[] steps, int idx) =>
            {
                InstallStep inStep = lstSteps[idx];
                steps[idx].optionalFileGroups.order = inStep.GroupSortOrder.ToString();
                steps[idx].optionalFileGroups.group = convertGroups(inStep.OptionGroups).ToArray();
            };

            InstallerStep[] uiSteps = convertSteps(lstSteps).ToArray();
            insertGroups(uiSteps, stepIdx);
            m_Delegates.ui.updateState(uiSteps, 0);
        }

        private int findNextIdx(IList<InstallStep> lstSteps, ConditionStateManager csmStateManager, int currentIdx)
        {
            for (int i = currentIdx + 1; i < lstSteps.Count; ++i) {
                if (lstSteps[i].VisibilityCondition.GetIsFulfilled(csmStateManager))
                {
                    return i;
                }
            }
            return -1;
        }

        private int findPrevIdx(IList<InstallStep> lstSteps, ConditionStateManager csmStateManager, int currentIdx)
        {
            for (int i = currentIdx - 1; i >= 0; --i) {
                if (lstSteps[i].VisibilityCondition.GetIsFulfilled(csmStateManager))
                {
                    return i;
                }
            }
            return 0;
        }

        

        #endregion
    }
}

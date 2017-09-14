using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FomodInstaller.Interface;
using System.Linq;
using FomodInstaller.Interface.ui;
using System.IO;

namespace FomodInstaller.Scripting.XmlScript
{
    /// <summary>
    /// Executes an XML script.
    /// </summary>
    public class XmlScriptExecutor : ScriptExecutorBase
    {
        private Mod ModArchive = null;
        private CoreDelegates m_Delegates;
        private ConditionStateManager m_csmState;

        #region Constructors

        /// <summary>
        /// A simple constructor that initializes the object with the required dependencies.
        /// </summary>
        /// <param name="modArchive">The mod object containing the file list in the mod archive.</param>
        /// <param name="UserInteractionDelegate">The utility class to use to install the mod items.</param>
        /// <param name="scxUIContext">The <see cref="SynchronizationContext"/> to use to marshall UI interactions to the UI thread.</param>		
        public XmlScriptExecutor(Mod modArchive, CoreDelegates coreDelegates)
        {
            ModArchive = modArchive;
            m_Delegates = coreDelegates;
        }

        #endregion

        #region ScriptExecutorBase Members

        /// <summary>
        /// Executes the script.
        /// </summary>
        /// <param name="scpScript">The XML Script to execute.</param>
        /// <param name="dataPath">path where data files for the script are stored</param>
        /// <returns><c>true</c> if the script completes successfully;
        /// <c>false</c> otherwise.</returns>
        /// <exception cref="ArgumentException">Thrown if <paramref name="scpScript"/> is not an
        /// <see cref="XmlScript"/>.</exception>
        public async override Task<IList<Instruction>> DoExecute(IScript scpScript, string dataPath)
        {
            TaskCompletionSource<IList<Instruction>> Source = new TaskCompletionSource<IList<Instruction>>(); 
            List<InstallableFile> PluginsToActivate = new List<InstallableFile>();

            m_csmState = new ConditionStateManager();
            
            if (!(scpScript is XmlScript))
                throw new ArgumentException("The given script must be of type XmlScript.", scpScript.Type.TypeName);

            XmlScript xscScript = (XmlScript)scpScript;

            if ((xscScript.ModPrerequisites != null) && !xscScript.ModPrerequisites.GetIsFulfilled(m_csmState, m_Delegates))
                throw new Exception(xscScript.ModPrerequisites.GetMessage(m_csmState, m_Delegates));

            IList<InstallStep> lstSteps = xscScript.InstallSteps;
            HeaderInfo hifHeaderInfo = xscScript.HeaderInfo;
            if (string.IsNullOrEmpty(hifHeaderInfo.ImagePath))
                hifHeaderInfo.ImagePath = string.IsNullOrEmpty(ModArchive.ScreenshotPath) ? null : Path.Combine(ModArchive.Prefix, ModArchive.ScreenshotPath);
            if ((hifHeaderInfo.Height < 0) && hifHeaderInfo.ShowImage)
                hifHeaderInfo.Height = 75;

            ISet<Option> selectedOptions = new HashSet<Option>();

            int stepIdx = findNextIdx(lstSteps, -1);

            Action<int, int, int[]> select = (int stepId, int groupId, int[] optionIds) =>
            {
                // this needs to happen asynchronously so that this call returns to javascript and js can
                // return to its main loop and respond to delegated requests, otherwise we could dead-lock
                Task.Run(() =>
                {
                    ISet<int> selectedIds = new HashSet<int>(optionIds);
                    IList<Option> options = lstSteps[stepId].OptionGroups[groupId].Options;
                    for (int i = 0; i < options.Count; ++i)
                    {
                        if (selectedIds.Contains(i) || (resolveOptionType(options[i]) == OptionType.Required))
                        {
                            selectedOptions.Add(options[i]);
                            options[i].Flags.ForEach((ConditionalFlag flag) =>
                            {
                                m_csmState.SetFlagValue(flag.Name, flag.ConditionalValue, options[i]);
                            });
                        }
                        else
                        {
                            selectedOptions.Remove(options[i]);
                            m_csmState.RemoveFlags(options[i]);
                        }
                    }
                    sendState(lstSteps, ModArchive.Prefix, selectedOptions, stepIdx);
                });
            };

            Action<bool> cont = (bool forward) => {
                // this needs to happen asynchronously, see above
                Task.Run(() =>
                {
                    if (forward)
                    {
                        stepIdx = findNextIdx(lstSteps, stepIdx);
                    }
                    else
                    {
                        stepIdx = findPrevIdx(lstSteps, stepIdx);
                    }

                    if (stepIdx == -1)
                    {
                        m_Delegates.ui.EndDialog();
                        XmlScriptInstaller xsiInstaller = new XmlScriptInstaller(ModArchive);
                        IEnumerable<InstallableFile> FilesToInstall = new List<InstallableFile>();
                        foreach (IEnumerable<InstallableFile> files in selectedOptions.Select(option => option.Files))
                        {
                            FilesToInstall = FilesToInstall.Union(files);
                        }
                        Source.SetResult(xsiInstaller.Install(xscScript, m_csmState, m_Delegates, FilesToInstall, PluginsToActivate));
                    }
                    else
                    {
                        preselectOptions(selectedOptions, lstSteps[stepIdx]);
                        sendState(lstSteps, ModArchive.Prefix, selectedOptions, stepIdx);
                    }
                });
            };
            Action cancel = () => {
                // this needs to happen asynchronously, see above
                Task.Run(() =>
                {
                    Source.SetCanceled();
                });
            };

            string bannerPath = string.IsNullOrEmpty(hifHeaderInfo.ImagePath)
                ? null
                : Path.Combine(ModArchive.Prefix, hifHeaderInfo.ImagePath);
            m_Delegates.ui.StartDialog(hifHeaderInfo.Title,
                new HeaderImage(bannerPath, hifHeaderInfo.ShowFade, hifHeaderInfo.Height),
                select, cont, cancel);

            preselectOptions(selectedOptions, lstSteps[stepIdx]);
            sendState(lstSteps, ModArchive.Prefix, selectedOptions, stepIdx);

            return await Source.Task;
        }
 
        private OptionType resolveOptionType(Option opt)
        {
            return opt.GetOptionType(m_csmState, m_Delegates);
        }

        private void preselectOptions(ISet<Option> selectedOptions, InstallStep step)
        {
            foreach (OptionGroup group in step.OptionGroups)
            {
                foreach (Option option in group.Options)
                {
                    OptionType type = resolveOptionType(option);
                    if ((type == OptionType.Required) || (type == OptionType.Recommended))
                    {
                        selectedOptions.Add(option);
                    }
                }
            }
        }

        private void sendState(IList<InstallStep> lstSteps, string strPrefixPath, ISet<Option> selected, int stepIdx)
        {
            Func<IEnumerable<InstallStep>, IEnumerable<InstallerStep>> convertSteps = steps =>
            {
                int idx = 0;
                return steps.Select(step => new InstallerStep(idx++, step.Name,
                    step.VisibilityCondition == null || step.VisibilityCondition.GetIsFulfilled(m_csmState, m_Delegates)));
            };

            Func<IEnumerable<Option>, IEnumerable<Interface.ui.Option>> convertOptions = options =>
            {
                int idx = 0;
                return options.Select(option => new Interface.ui.Option(idx++, option.Name, option.Description,
                    string.IsNullOrEmpty(option.ImagePath) ? null : Path.Combine(strPrefixPath, option.ImagePath),
                    selected.Contains(option), resolveOptionType(option).ToString()));
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
            m_Delegates.ui.UpdateState(uiSteps, stepIdx);
        }

        private int findNextIdx(IList<InstallStep> lstSteps, int currentIdx)
        {
            for (int i = currentIdx + 1; i < lstSteps.Count; ++i) {
                if ((lstSteps[i].VisibilityCondition == null) ||
                    lstSteps[i].VisibilityCondition.GetIsFulfilled(m_csmState, m_Delegates))
                {
                    return i;
                }
            }
            return -1;
        }

        private int findPrevIdx(IList<InstallStep> lstSteps, int currentIdx)
        {
            for (int i = currentIdx - 1; i >= 0; --i) {
                if ((lstSteps[i].VisibilityCondition == null) ||
                    lstSteps[i].VisibilityCondition.GetIsFulfilled(m_csmState, m_Delegates))
                {
                    return i;
                }
            }
            return 0;
        }

        #endregion
    }
}

const part = (name, type, description, functionText, connections, notes) =>
  ({name, type, description, functionText, connections: connections.split(' '), notes});

export const layers = [
  {id:'hardware', name:'Hardware', zh:'硬件', color:0x78c9fa, root:'gpu'},
  {id:'compute', name:'Compute', zh:'算子', color:0x84b6ff, root:'gemm'},
  {id:'runtime', name:'Memory & Runtime', zh:'内存与运行时', color:0x62c9c9, root:'runtime-engine'},
  {id:'model', name:'Model', zh:'Transformer', color:0xad9df4, root:'decoder'},
  {id:'agent', name:'Agent', zh:'智能体', color:0xc0a4f3, root:'agent-core'},
  {id:'application', name:'Application', zh:'应用', color:0xeac490, root:'web-ui'}
];

export const parts = {
  hardware: {
    gpu: part('GPU Package','物理封装','以带 HBM 的数据中心 GPU 为参考的概念封装。','把 GPU Die 和 HBM 接到同一封装内，提供供电、散热和对外连接。','die hbm interposer substrate pcie nvlink','概念示意，零件数量、尺寸与位置不对应任何在售芯片。PCIe 和 NVLink 的板级形态随产品而变。'),
    substrate: part('Substrate','封装基板','封装下方的有机基板。','把封装连接到板级供电与信号线路。','gpu interposer','基板和硅中介层承担不同尺度的布线。'),
    interposer: part('Interposer','封装互连','GPU Die 与 HBM 下方的中介层。','提供连接 GPU 与 HBM 的高密度布线。','die hbm substrate','在这个概念封装里，GPU Die 与 HBM 并排连接到中介层。'),
    hbm: part('HBM Stack','封装内显存','多层 DRAM 芯片堆叠在 GPU Die 两侧。','通过宽接口为 GPU 提供高带宽的外部显存。','interposer memory-controller weights kv-cache','HBM 位于 GPU Die 外、封装内。权重与 KV Cache 是可存放在其中的逻辑数据。'),
    die: part('GPU Die','硅芯片','封装中央的逻辑芯片。','包含计算阵列、片上缓存、显存控制器和 I/O。','gpu gpc l2 memory-controller','去掉封装层才能看到芯片结构。这些结构实际位于同一片硅上。'),
    gpc: part('GPC / TPC','计算簇','示意 GPC 包含 TPC，TPC 内组织若干 SM。','把大量执行资源组织成更大的计算阵列。','die sm l2','簇的数量和组成随架构变化。'),
    sm: part('SM','执行资源组织单元','Streaming Multiprocessor，GPU 执行线程束的基本组织单元。','调度线程束，共享寄存器文件、算术单元及片上存储。','gpc tensor cuda registers shared l1','画面将代表性 SM 放大拆开，便于区分内部资源。'),
    tensor: part('Tensor Core','SM 内张量计算单元','专门执行受支持的矩阵乘累加运算。','加速 GEMM 等可映射到矩阵乘累加的工作负载。','sm cuda registers shared gemm','吞吐依赖数据精度、矩阵形状与实际内核实现。'),
    cuda: part('CUDA Core','SM 内算术单元','用于执行通用算术指令的标量执行资源。','处理许多逐元素与常规算术操作。','sm tensor registers','不同架构有不同的浮点、整数执行通路。'),
    registers: part('Register File','SM 内寄存器文件','保存正在运行的线程的寄存器值。','为执行单元提供低延迟操作数。','sm cuda tensor','每线程寄存器占用会影响同驻线程束数量。'),
    shared: part('Shared Memory','SM 内共享存储','线程块内线程可以显式读写的片上存储。','在同一线程块内复用数据或交换中间结果。','sm l1 tensor','部分架构中 Shared Memory 与 L1 共享物理资源。'),
    l1: part('L1 Cache','SM 内缓存','靠近执行单元的一级数据缓存。','缓存部分访存请求，减少访问下级缓存的次数。','sm shared l2','缓存策略和可配置容量随架构、指令和配置而变。'),
    l2: part('L2 Cache','芯片内共享缓存','GPU Die 内部供多个 SM 共享的缓存。','在计算阵列和显存之间复用数据。','die sm l1 memory-controller','拆解时仍属于 Die，它不在 HBM 堆栈中。'),
    'memory-controller': part('Memory Controller','芯片内显存接口','GPU Die 内连接显存通道的控制逻辑。','组织对 HBM 通道的读写。','die l2 hbm','这里显示的是逻辑归属，真实控制器分布以具体芯片为准。'),
    pcie: part('PCIe Interface','主机互连','连接 GPU 与主机或其他 PCIe 设备的接口。','传输命令和数据。','gpu nvlink runtime-engine','图中外沿端口标记代表接口角色，不是特定板卡的插槽。'),
    nvlink: part('NVLink Interface','设备互连','部分 NVIDIA 产品支持的高速互连。','在支持的系统中提供设备间或 CPU–GPU 通信。','gpu pcie','是否支持以及连接形式取决于产品和系统。')
  },
  compute: {
    gemm: part('Matrix Multiplication / GEMM','矩阵算子','一般矩阵乘法的核心是按行与列做点积。','将输入与权重投影为输出，广泛用于注意力和 MLP。','qkv mlp tensor','演示为 C = A × B。标准 GEMM 还可以包含缩放和累加。'),
    attention: part('Attention','计算算子','用查询与键的相似度构造权重，再对值加权求和。','让当前位置使用可见上下文的信息。','qkv softmax heads flash','自回归解码器使用因果约束，屏蔽未来位置。'),
    softmax: part('Softmax','归一化算子','将一组分数指数归一化为和为 1 的权重。','将注意力分数或词表分数转成相对权重。','attention logits sampling','数值稳定的实现通常先减去最大值。'),
    'rms-norm': part('RMSNorm','归一化算子','用均方根尺度归一化输入，并使用可学习权重。','控制激活尺度。','norm layernorm','与 LayerNorm 相比，它通常不执行均值中心化。'),
    layernorm: part('LayerNorm','归一化算子','对特征维做均值中心化和方差归一化。','稳定每个位置的激活尺度。','rms-norm norm','归一化方式取决于模型架构。'),
    ffn: part('MLP / FFN','前馈算子','逐位置应用线性层及非线性，也可使用门控结构。','在特征维变换隐藏状态。','gemm mlp residual','计算常由多个矩阵乘内核与逐元素操作组成。'),
    flash: part('FlashAttention','注意力内核','分块计算精确注意力，减少往返高带宽显存的读写。','避免把完整注意力矩阵写到 HBM。','attention shared hbm','计算结果在浮点舍入误差范围内与常规注意力一致。'),
    quantization: part('Quantization','低精度表示','将权重、激活或缓存表示为更低精度。','降低存储与搬运开销，并在支持的内核上加速。','weights kv-cache gemm','实际收益取决于量化方法、硬件支持和精度要求。')
  },
  runtime: {
    'runtime-engine': part('Inference Runtime','推理运行时','协调模型执行、GPU 内核和资源分配。','将请求变为可调度的 Prefill、Decode 工作。','queue scheduler streams decoder','这一层展示的是软件资源及逻辑数据。'),
    weights: part('Model Weights','显存逻辑数据','训练产生的模型参数。','用于线性投影和其他带参数的操作。','decoder gemm pool hbm','权重在推理期间通常只读，可按精度与并行策略存储。'),
    activations: part('Activations','中间张量','当前前向计算产生的中间结果。','在层和算子之间传递状态。','decoder gemm pool','部分张量在消费后可释放或复用。'),
    'kv-cache': part('KV Cache','显存逻辑数据','按模型层保存已处理位置的 Key 和 Value。','在 Decode 中复用历史 K/V，避免每一步都重算历史位置的投影。','qkv heads pool paged hbm','示意条块代表位置。采样出的新 Token 在下一次被送入模型时才写入对应 K/V。'),
    pool: part('Memory Pool','内存分配器','运行时预留并复用的一组内存块。','按请求或张量需要分配、回收块。','kv-cache weights activations paged','请求结束后可归还其缓存块，实际回收由运行时管理。'),
    queue: part('Batch Queue','请求队列','保存等待调度的请求。','向调度器提供新请求或仍在生成的序列。','scheduler runtime-engine','排队、批大小和优先级由运行时策略控制。'),
    scheduler: part('Scheduler','请求调度器','按计算与显存预算选择执行任务。','把可同时执行的请求组合成批次。','queue streams kv-cache','连续批处理可以在生成迭代之间更新批次成员。'),
    streams: part('CUDA Streams','GPU 执行队列','一组按顺序提交 GPU 操作的队列。','安排内核执行和数据传输。','scheduler gemm gpu','跨流能否并行还取决于依赖和可用硬件资源。'),
    paged: part('PagedAttention','分页 KV Cache 访问','把序列的逻辑位置映射到不必连续的物理缓存块。','降低 KV Cache 的碎片与预留浪费。','kv-cache pool scheduler','可按需分配缓存块。这里的块只是教学单位。')
  },
  model: {
    decoder: part('Transformer Decoder Block','自回归模型块','这个示例采用 pre-norm 解码器，注意力与 MLP 都有残差路径。','变换隐藏状态，堆叠后为下一个 Token 的预测提供表示。','embedding norm heads residual mlp projection','Tokenizer、Embedding 和输出头围绕块堆栈展示，属于模型链路的不同位置。'),
    tokenizer: part('Tokenizer','输入与输出编解码','把文本映射为 Token ID，也可将 ID 还原为文本。','提供模型处理的离散输入。','embedding sampling','演示的中文分块用于教学，未运行真实分词器。'),
    embedding: part('Embedding','查表层','将 Token ID 映射为向量。','把离散输入转换为连续隐藏状态。','tokenizer norm decoder','输出投影可与词嵌入共享权重，取决于模型。'),
    rope: part('RoPE','位置编码','用随位置变化的旋转变换调制 Q 和 K。','让注意力分数携带相对位置信息。','qkv heads','在常见实现中 V 不执行这项旋转。'),
    norm: part('RMSNorm','块内归一化','在该示例中，先归一化再进入注意力或 MLP。','调节特征尺度。','rms-norm heads mlp','画面以一个标记代表两个子层前的归一化位置。'),
    qkv: part('Q / K / V Projection','线性投影','将隐藏状态分别投影为 Query、Key 和 Value。','为每个注意力头提供查询、键和值。','gemm rope heads kv-cache','自回归生成时复用过去位置的 K/V。'),
    heads: part('Multi-Head Attention','注意力子层','多组 Q、K、V 在各自头中计算注意力。','把各头结果组合并投影回隐藏空间。','qkv attention residual rope kv-cache','许多模型采用共享 K/V 的分组查询注意力。'),
    residual: part('Residual Connection','残差路径','将子层输入加回该子层输出。','保留原始隐藏状态的信息通路。','heads mlp decoder','示意图的旁路代表注意力和 MLP 各自的残差加法。'),
    mlp: part('MLP / FFN','前馈子层','在每个位置上独立变换特征。','常见结构先扩展维度，再投影回模型宽度。','gemm ffn norm residual','实际实现可使用门控激活。'),
    projection: part('Output Projection','词表投影','将最后一层隐藏状态投影到词表空间。','为每个可能的下一个 Token 计算一个分数。','decoder logits','这一层在整个 Decoder 堆栈之后。'),
    logits: part('Logits','未归一化分数','模型输出的词表分数。','为下一个 Token 的选择提供依据。','projection softmax sampling','温度缩放和过滤可在采样前修改分数或候选。'),
    sampling: part('Sampling','Token 选择','将候选分数转成分布，再按策略抽样。','输出下一个 Token ID。','logits softmax tokenizer','贪心选择也可直接取最大分数。')
  },
  agent: {
    'agent-core': part('Agent Core','编排运行时','把模型、任务上下文和工具组合成可执行的流程。','组织一次 Think → Plan → Act → Observe → Respond 循环。','llm planner context tool observation workflow','循环是示意策略，可按任务跳过某些步骤。'),
    llm: part('LLM','生成模型','读取上下文并生成文本或结构化工具意图。','为规划与回应提供候选输出。','context tool decoder','运行时仍负责验证输出与执行权限。'),
    planner: part('Planner','规划组件','生成或调整任务步骤。','选择继续推理、调用工具或返回。','agent-core llm workflow','计划可以是规则、模型结果或两者的组合。'),
    context: part('Context','输入上下文','组装任务、历史、检索材料和工具结果。','为模型构造当前输入。','llm memory rag observation','需要在上下文长度与信息相关性之间取舍。'),
    memory: part('Memory','应用状态','保存跨步骤或跨会话的信息。','向当前任务提供可检索状态。','context rag database','Agent Memory 与 GPU 上的 KV Cache 是不同层次的状态。'),
    rag: part('RAG','检索增强','先检索相关材料，再把材料送入模型上下文。','让回答可以引用检索到的材料。','search context database','检索质量、权限与上下文组织都会影响输出。'),
    tool: part('Tool Calling','工具执行','解析结构化调用意图，经检查后发送到外部工具。','将模型建议变为有边界的执行请求。','llm mcp observation search browser file api database','工具结果要经运行时传回，模型不会自行执行系统操作。'),
    mcp: part('MCP','工具连接协议','主机可通过客户端连接服务器，访问服务器提供的能力。','让应用发现并调用符合协议的工具。','tool agent-core','应用仍负责权限、用户确认与错误处理。'),
    observation: part('Observation','工具结果','工具返回的数据或错误。','为下一轮规划或最终回应提供输入。','tool context planner','工具返回可作为有来源的输入，仍需验证。'),
    workflow: part('Workflow','流程控制','管理执行顺序、分支和退出条件。','控制计划、工具执行及结果返回。','planner agent-core observation','生产流程常有重试与权限边界。'),
    search: part('Search','外部工具','按查询检索资料。','返回匹配条目及来源。','rag tool observation','演示仅读取预设资料。'),
    database: part('Database Tool','外部工具','通过受控接口查询数据。','返回结构化记录。','tool memory storage','读写能力由应用权限决定。'),
    browser: part('Browser','外部工具','经受控接口访问网页内容。','返回网页内容或操作结果。','tool observation','网页内容作为外部输入处理。'),
    file: part('File','外部工具','读取指定文件。','把报告内容交回 Agent。','tool observation','请求回放使用内置的示例报告。'),
    api: part('API Tool','外部工具','调用获授权的服务端接口。','获得数据或执行指定动作。','tool service observation','外部动作由运行时管理权限。')
  },
  application: {
    'web-ui': part('Web UI','用户界面','在网页接收请求并展示结果。','把人的操作映射为业务请求。','mobile service business','流式显示可边接收边更新。'),
    mobile: part('Mobile App','用户界面','移动端的输入与反馈界面。','连接用户操作和应用服务。','web-ui service notify','移动网络与设备能力会影响交互。'),
    service: part('API Service','服务接口','接收经过验证的业务请求。','协调业务规则和 AI 工作流。','web-ui business agent-core','可在服务边界实现权限、速率限制与追踪。'),
    business: part('Business Logic','业务规则','定义任务可执行的规则和限制。','校验请求并编排后续动作。','service storage notify','模型输出通过业务规则后才进入业务状态。'),
    storage: part('Database','持久化存储','保存应用记录与业务状态。','提供受控读写和查询。','business database','数据保留和访问权限由应用配置。'),
    notify: part('Notification','结果通知','将结果或事件反馈给用户。','在页面、移动端或其他渠道发送状态。','business mobile web-ui','通常应支持失败处理与去重。'),
    iot: part('IoT / Sensors','外部设备','通过应用接口提供设备或传感器数据。','为业务工作流提供事件和输入。','service business','设备数据需经过校验并处理缺失。')
  }
};

export const hardwareGeometry = {
  substrate: {size:[8.5,.34,6.2], base:[0,-.28,0], shift:[0,-.74,0], window:[.05,.55]},
  interposer: {size:[7.8,.16,5.5], base:[0,0,0], shift:[0,.22,0], window:[.10,.58]},
  die: {size:[3.85,.32,3.95], base:[0,.25,0], shift:[0,1.36,0], window:[.16,.68]},
  hbm: {size:[1.24,.56,1.3], base:[2.8,.40,1.05], shift:[.89,.50,.25], window:[.20,.65]}
};

export const prompt = '帮我总结一份技术报告，并提取重点。';
export const promptTokens = ['帮我','总结','一份','技术','报告','并','提取','重点'];
export const decodedTokens = ['摘要','已','生成','。'];
export const reportExcerpt = '两种推理引擎共用一套输入和预期结果。每次评测在独立进程中执行，避免相互影响。运行结束后，日志和结果采用同一套结构归档。';
export const sampleReport = '示例报告建议复用评测用例、隔离执行环境、统一记录结果。';
export const requestSteps = [
  {layer:'application', name:'Application', part:'web-ui', text:'网页收到请求和实验室附带的示例报告。'},
  {layer:'agent', name:'Agent Runtime', part:'agent-core', text:'运行时组装任务上下文，选择先让模型整理报告。'},
  {layer:'runtime', name:'Inference Engine · Prefill', part:'runtime-engine', text:'输入 Token 一起进入 Prefill。经过下一阶段的模型计算后，运行时保留初始 K/V。'},
  {layer:'model', name:'Transformer', part:'decoder', text:'解码器使用因果注意力和 MLP 变换隐藏状态，输出头计算词表分数。'},
  {layer:'compute', name:'Kernel', part:'gemm', text:'运行时将模型算子映射到矩阵乘和注意力等 GPU 内核。'},
  {layer:'hardware', name:'GPU Hardware', part:'gpu', text:'内核运行在 SM 上，使用适用的计算单元，并通过片上缓存和 HBM 读写数据。'},
  {layer:'runtime', name:'Decode', part:'kv-cache', text:'由 Prefill 的 logits 选出第一个 Token。后续迭代读取历史 K/V，并把刚送入模型的位置追加进缓存。'},
  {layer:'agent', name:'Agent · Observation', part:'tool', text:'Agent 请求读取示例报告附注。工具返回 Observation，Agent 据此校对重点。'},
  {layer:'application', name:'Application · Response', part:'web-ui', text:'页面收到教学示例的最终回复。' }
];

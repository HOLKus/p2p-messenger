const common = {
    borderRadius: '16px',
    transition: 'all 0.2s ease-in-out',
};

export const lightStyles = {
    ...common,
    appContainer: { 
        display: 'flex', height: '100vh', width: '100vw', 
        background: '#E9EBEE', color: '#1C1E21', overflow: 'hidden',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    },
    leftColumn: { 
        minWidth: '280px', width: '30%', background: '#FFFFFF', 
        borderRight: '2px solid #D1D5DB', display: 'flex', flexDirection: 'column',
    },
    rightColumn: { 
        flex: 1, display: 'flex', flexDirection: 'column', 
        background: '#F0F2F5', position: 'relative' 
    },
    friendItem: {
        display: 'flex', alignItems: 'center', padding: '12px 16px', margin: '6px 12px',
        borderRadius: '14px', cursor: 'pointer', color: '#1C1E21', background: '#F3F4F6',
        border: '1px solid #E5E7EB'
    },
    friendItemActive: { background: '#DBEAFE', border: '1px solid #3B82F6', color: '#1D4ED8' },
    
    chatHeader: { 
        padding: '12px 20px', background: '#FFFFFF', display: 'flex', 
        justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #D1D5DB',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    },
    messagesContainer: { 
        flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' 
    },
    myMsg: { 
        alignSelf: 'flex-end', background: '#2563EB', color: '#FFFFFF', 
        padding: '10px 14px', borderRadius: '18px 18px 2px 18px', maxWidth: '75%',
        boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
    },
    theirMsg: { 
        alignSelf: 'flex-start', background: '#FFFFFF', color: '#1C1E21', 
        padding: '10px 14px', borderRadius: '18px 18px 18px 2px', maxWidth: '75%',
        border: '1px solid #D1D5DB'
    },
    inputArea: { 
        padding: '15px 20px', background: '#FFFFFF', display: 'flex', alignItems: 'center', 
        gap: '12px', borderTop: '2px solid #D1D5DB' 
    },
    mainInput: { 
        flex: 1, padding: '12px 18px', borderRadius: '24px', border: '2px solid #D1D5DB', 
        fontSize: '16px', outline: 'none', background: '#F9FAFB', color: '#1C1E21'
    },
    btnBlue: { background: '#2563EB', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: '600', cursor: 'pointer' },
    btnGreen: { background: '#10B981', color: '#fff', border: 'none', width: '42px', height: '42px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px' },
    iconBtn: { background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: 'inherit', marginLeft: '4px' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modalContent: { background: '#FFFFFF', padding: '24px', borderRadius: '20px', width: '320px', color: '#1C1E21' }
};

export const darkStyles = {
    ...lightStyles,
    appContainer: { ...lightStyles.appContainer, background: '#0F172A', color: '#F1F5F9' },
    leftColumn: { ...lightStyles.leftColumn, background: '#1E293B', borderRight: '1px solid #334155' },
    rightColumn: { ...lightStyles.rightColumn, background: '#0F172A' },
    friendItem: { ...lightStyles.friendItem, background: '#334155', border: '1px solid #475569', color: '#F1F5F9' },
    friendItemActive: { background: '#1E40AF', border: '1px solid #3B82F6', color: '#EFF6FF' },
    chatHeader: { ...lightStyles.chatHeader, background: '#1E293B', borderBottom: '1px solid #334155' },
    myMsg: { ...lightStyles.myMsg, background: '#3B82F6' },
    theirMsg: { ...lightStyles.theirMsg, background: '#1E293B', color: '#F1F5F9', border: '1px solid #334155' },
    inputArea: { ...lightStyles.inputArea, background: '#1E293B', borderTop: '1px solid #334155' },
    mainInput: { ...lightStyles.mainInput, background: '#0F172A', border: '1px solid #334155', color: '#fff' },
    modalContent: { ...lightStyles.modalContent, background: '#1E293B', color: '#F1F5F9' }
};
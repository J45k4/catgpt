import React, { useEffect, useRef } from 'react';

interface ModalProps {
    show?: boolean;
    title?: string;
    onClose?: () => void;
    children?: React.ReactNode;
    footerContent?: React.ReactNode; // Added type for footer content
}

export const Modal: React.FC<ModalProps> = (props) => {
    const modalRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const previousActiveElementRef = useRef<any | null>(null);

    useEffect(() => {
        if (props.show) {
            previousActiveElementRef.current = document.activeElement;
            modalRef.current?.focus();
        } else {
            previousActiveElementRef.current?.focus();
        }
    }, [props.show]);

    if (!props.show) {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
            }}
            onClick={props.onClose}
        >
            <div
                ref={modalRef}
                style={{
                    padding: '20px',
                    background: '#fff',
                    borderRadius: '5px',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '300px',
                    margin: '1rem',
                    position: 'relative',
                    minWidth: '300px',
                    boxShadow: '0 3px 9px rgba(0, 0, 0, 0.5)',
                    zIndex: 1001
                }}
                onClick={e => e.stopPropagation()}
                tabIndex={-1}
                aria-modal="true"
                role="dialog"
                aria-labelledby="modalTitle"
            >
                <div style={{ marginBottom: "10px" }}>
                    <h1 id="modalTitle" style={{ fontSize: "30px" }}>{props.title}</h1>
                </div>
                <div style={{ flexGrow: 1 }}>
                    {props.children}
                </div>
                {/* Footer Section */}
                <div style={{
                    borderTop: '1px solid #eee',
                    marginTop: '20px',
                    paddingTop: '10px',
                    textAlign: 'right',
                }}>
                    {props.footerContent}
                </div>
            </div>
        </div>
    );
};

import React, { MouseEventHandler, useEffect, useState } from "react";
import { Button, IconButton } from "@mui/material";
import { useSignOut } from "react-auth-kit";
import { ArrowBackIosNew as ArrowBackIosIcon, ArrowForwardIos as ArrowForwardIosIcon } from "@mui/icons-material";

const SignoutFab = () => {
  const signout = useSignOut();
  const [isOpen, setIsOpen] = useState(false);
  const [lastArrowClick, setLastArrowClick] = useState<number>(0);

  const toggleOpen: MouseEventHandler<HTMLButtonElement> = (e) => {
    const now = Date.now();
    setLastArrowClick(now);
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  const onClickSignout: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    signout();
  };

  const outSideClickHandler = (e: MouseEvent) => {
    if (Date.now() - lastArrowClick < 100) return;
    setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("click", outSideClickHandler);
    } else {
      document.removeEventListener("click", outSideClickHandler);
    }

    return () => {
      document.removeEventListener("click", outSideClickHandler);
    };
  }, [isOpen]);

  return (
    <>
      <IconButton size="small" onClick={toggleOpen} className="fab">
        <ArrowBackIosIcon className={`fab__btn-narrow${isOpen ? " forward" : ""}`} />
      </IconButton>

      <Button
        className={`fab__btn-signout${isOpen ? " open" : ""}`}
        variant="contained"
        size="small"
        color="info"
        onClick={onClickSignout}
      >
        Sign Out
      </Button>
    </>
  );
};

export default SignoutFab;
